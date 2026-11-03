const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { db, admin } = require('../database/firebase');
const {
  createRecord,
  getRecord,
  listRecords,
  isValidDocId
} = require('../services/firebase-data.service');
const notificationService = require('../services/notification.service');

/**
 * Forum routes for the student Q&A board.
 *
 * Everything here is real data. When the datastore is unavailable the request
 * fails with an error status: nothing is invented to fill an empty screen and a
 * write is never reported as successful unless it was stored.
 */

const QUESTIONS = 'forum_questions';
const ANSWERS = 'forum_answers';
const IN_QUERY_CHUNK = 30;
const MAX_TITLE = 200;
const MAX_BODY = 10000;

// Stats and contributors scan two collections; a minute of staleness is fine.
const summaryCache = new NodeCache({ stdTTL: 60, checkperiod: 120, useClones: false });

const getUserId = (user) => (user?.id || user?.uid || null);

function increment(by) {
  const fieldValue = admin?.firestore?.FieldValue;
  if (!fieldValue || typeof fieldValue.increment !== 'function') {
    throw new Error('Firestore FieldValue.increment is unavailable');
  }
  return fieldValue.increment(by);
}

/** Never expose who voted: only whether the caller did. */
function toPublicPost(post, viewerId) {
  const { upvotedBy, ...rest } = post;
  const voters = Array.isArray(upvotedBy) ? upvotedBy : [];
  return {
    ...rest,
    userHasUpvoted: viewerId ? voters.includes(viewerId) : false
  };
}

async function lookupUsers(ids) {
  const found = new Map();
  const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
  for (let index = 0; index < unique.length; index += IN_QUERY_CHUNK) {
    const users = await listRecords('users', {
      filters: [{ field: 'id', op: 'in', value: unique.slice(index, index + IN_QUERY_CHUNK) }]
    });
    users.forEach((user) => found.set(String(user.id), user));
  }
  return found;
}

/** Posts written before author names were stored get them from the user record. */
async function withAuthors(posts) {
  const missing = posts.filter((post) => !post.author_name).map((post) => post.user_id);
  if (missing.length === 0) return posts;

  const users = await lookupUsers(missing);
  return posts.map((post) => {
    if (post.author_name) return post;
    const author = users.get(String(post.user_id));
    return { ...post, author_name: author?.name || 'Unknown user', author_role: author?.role || null };
  });
}

function parsePaging(query, defaultLimit = 10) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(query.limit, 10) || defaultLimit))
  };
}

/**
 * @route   GET /api/forum/questions
 * @desc    List questions with filters, search, sorting and pagination
 * @access  Public (optional auth personalises the upvote state)
 */
router.get('/questions', optionalAuth, async (req, res, next) => {
  try {
    const { category, status, search, sortBy = 'newest', tag } = req.query;
    const { page, limit } = parsePaging(req.query);
    const viewerId = getUserId(req.user);

    const filters = [];
    if (category && category !== 'all') filters.push({ field: 'category', value: String(category) });
    if (status === 'answered' || status === 'open') filters.push({ field: 'status', value: status });

    let questions = await listRecords(QUESTIONS, { filters });

    if (tag) {
      const wanted = String(tag).trim().toLowerCase();
      questions = questions.filter((question) => String(question.tags || '')
        .split(',').map((item) => item.trim().toLowerCase()).includes(wanted));
    }

    if (search) {
      const needle = String(search).trim().toLowerCase();
      questions = questions.filter((question) => [question.title, question.description, question.tags]
        .some((field) => String(field || '').toLowerCase().includes(needle)));
    }

    const byNewest = (left, right) => String(right.created_at || '').localeCompare(String(left.created_at || ''));
    if (sortBy === 'popular') {
      questions.sort((left, right) => (right.upvotes || 0) - (left.upvotes || 0) || byNewest(left, right));
    } else if (sortBy === 'oldest') {
      questions.sort((left, right) => -byNewest(left, right));
    } else if (sortBy === 'unanswered') {
      questions = questions.filter((question) => !(question.answer_count > 0));
      questions.sort(byNewest);
    } else {
      questions.sort(byNewest);
    }

    const total = questions.length;
    const pageItems = await withAuthors(questions.slice((page - 1) * limit, page * limit));

    res.json({
      success: true,
      questions: pageItems.map((question) => toPublicPost(question, viewerId)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/forum/stats
 * @desc    Forum statistics (real counts; zeros when the forum is empty)
 * @access  Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const cached = summaryCache.get('stats');
    if (cached) return res.json({ success: true, stats: cached });

    const [questions, answers] = await Promise.all([listRecords(QUESTIONS), listRecords(ANSWERS)]);

    const stats = {
      total_questions: questions.length,
      answered_questions: questions.filter((question) => question.status === 'answered').length,
      active_users: new Set([...questions, ...answers].map((post) => post.user_id).filter(Boolean)).size,
      total_answers: answers.length
    };

    summaryCache.set('stats', stats);
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/forum/contributors
 * @desc    Top answerers, ranked by upvotes received
 * @access  Public
 */
router.get('/contributors', async (req, res, next) => {
  try {
    const cached = summaryCache.get('contributors');
    if (cached) return res.json({ success: true, contributors: cached });

    const answers = await listRecords(ANSWERS);

    const totals = new Map();
    for (const answer of answers) {
      if (!answer.user_id) continue;
      const entry = totals.get(answer.user_id) || { answer_count: 0, total_upvotes: 0 };
      entry.answer_count += 1;
      entry.total_upvotes += answer.upvotes || 0;
      totals.set(answer.user_id, entry);
    }

    const top = Array.from(totals.entries())
      .sort(([, left], [, right]) => right.total_upvotes - left.total_upvotes || right.answer_count - left.answer_count)
      .slice(0, 5);

    const users = await lookupUsers(top.map(([userId]) => userId));
    const contributors = top.map(([userId, entry]) => ({
      id: userId,
      name: users.get(String(userId))?.name || 'Unknown user',
      role: users.get(String(userId))?.role || null,
      ...entry
    }));

    summaryCache.set('contributors', contributors);
    res.json({ success: true, contributors });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/forum/questions/:id
 * @desc    A question with its answers (accepted first, then by votes)
 * @access  Public
 */
router.get('/questions/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = getUserId(req.user);

    const question = isValidDocId(id) ? await getRecord(QUESTIONS, id) : null;
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const answers = (await listRecords(ANSWERS, {
      filters: [{ field: 'question_id', value: id }]
    })).sort((left, right) => {
      if (Boolean(right.is_accepted) !== Boolean(left.is_accepted)) return right.is_accepted ? 1 : -1;
      return (right.upvotes || 0) - (left.upvotes || 0)
        || String(left.created_at || '').localeCompare(String(right.created_at || ''));
    });

    const [[withAuthor], answersWithAuthors] = await Promise.all([withAuthors([question]), withAuthors(answers)]);

    // Atomic, best-effort view counter (a failed count must not fail the read).
    db.collection(QUESTIONS).doc(id).update({ views: increment(1) }).catch((error) => {
      console.warn('Forum view count failed:', error.message);
    });

    res.json({
      success: true,
      question: {
        ...toPublicPost(withAuthor, viewerId),
        answers: answersWithAuthors.map((answer) => toPublicPost(answer, viewerId))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/forum/questions
 * @desc    Create a new question
 * @access  Private
 */
router.post('/questions', verifyToken, async (req, res, next) => {
  try {
    const { title, description, category, tags } = req.body || {};
    const userId = getUserId(req.user);

    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    const cleanCategory = typeof category === 'string' ? category.trim() : '';

    if (!cleanTitle || !cleanDescription || !cleanCategory) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required'
      });
    }
    if (cleanTitle.length > MAX_TITLE || cleanDescription.length > MAX_BODY) {
      return res.status(400).json({
        success: false,
        message: `Title is limited to ${MAX_TITLE} characters and the description to ${MAX_BODY}`
      });
    }

    const tagsString = Array.isArray(tags)
      ? tags.map((tagItem) => String(tagItem).trim()).filter(Boolean).join(',')
      : String(tags || '').trim();

    const question = await createRecord(QUESTIONS, {
      user_id: userId,
      author_name: req.user.name || null,
      author_role: req.user.role || null,
      title: cleanTitle,
      description: cleanDescription,
      category: cleanCategory,
      tags: tagsString,
      status: 'open',
      views: 0,
      upvotes: 0,
      upvotedBy: [],
      answer_count: 0
    });

    summaryCache.flushAll();
    res.status(201).json({
      success: true,
      question: toPublicPost(question, userId),
      message: 'Question posted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/forum/questions/:id/answers
 * @desc    Answer a question
 * @access  Private
 */
router.post('/questions/:id/answers', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req.user);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Answer content is required'
      });
    }
    if (content.length > MAX_BODY) {
      return res.status(400).json({ success: false, message: `Answers are limited to ${MAX_BODY} characters` });
    }

    const question = isValidDocId(id) ? await getRecord(QUESTIONS, id) : null;
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const answerRef = db.collection(ANSWERS).doc();
    const now = new Date().toISOString();
    const answer = {
      id: answerRef.id,
      question_id: id,
      user_id: userId,
      author_name: req.user.name || null,
      author_role: req.user.role || null,
      content,
      upvotes: 0,
      upvotedBy: [],
      is_accepted: false,
      created_at: now
    };

    // The answer and the question's counters change together or not at all.
    const batch = db.batch();
    batch.set(answerRef, answer);
    batch.update(db.collection(QUESTIONS).doc(id), {
      answer_count: increment(1),
      status: 'answered',
      updated_at: now
    });
    await batch.commit();

    summaryCache.flushAll();

    if (question.user_id && question.user_id !== userId) {
      await notificationService.create({
        userId: question.user_id,
        title: 'New answer to your question',
        message: `${req.user.name || 'Someone'} answered "${question.title}".`,
        type: 'forum',
        link: '/dashboard/student-forum.html',
        metadata: { questionId: id, answerId: answer.id }
      });
    }

    res.status(201).json({
      success: true,
      answer: toPublicPost(answer, userId),
      message: 'Answer posted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Toggle the caller's upvote on a question or answer, atomically.
 */
async function toggleUpvote(collection, id, userId) {
  const ref = db.collection(collection).doc(id);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return { status: 'not_found' };

    const data = snapshot.data();
    if (data.user_id === userId) return { status: 'own_post' };

    const voters = Array.isArray(data.upvotedBy) ? data.upvotedBy : [];
    const hasUpvoted = voters.includes(userId);
    const nextVoters = hasUpvoted ? voters.filter((voterId) => voterId !== userId) : [...voters, userId];
    const upvotes = nextVoters.length;

    tx.update(ref, { upvotes, upvotedBy: nextVoters });
    return { status: 'ok', upvotes, userHasUpvoted: !hasUpvoted };
  });
}

function sendUpvoteResult(res, result, noun) {
  if (result.status === 'not_found') {
    return res.status(404).json({ success: false, message: `${noun} not found` });
  }
  if (result.status === 'own_post') {
    return res.status(400).json({ success: false, message: `You cannot upvote your own ${noun.toLowerCase()}` });
  }
  return res.json({
    success: true,
    message: result.userHasUpvoted ? `${noun} upvoted` : `${noun} upvote removed`,
    upvotes: result.upvotes,
    userHasUpvoted: result.userHasUpvoted
  });
}

/**
 * @route   POST /api/forum/questions/:id/upvote
 * @access  Private
 */
router.post('/questions/:id/upvote', verifyToken, async (req, res, next) => {
  try {
    if (!isValidDocId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    const result = await toggleUpvote(QUESTIONS, req.params.id, getUserId(req.user));
    summaryCache.flushAll();
    sendUpvoteResult(res, result, 'Question');
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/forum/answers/:id/upvote
 * @access  Private
 */
router.post('/answers/:id/upvote', verifyToken, async (req, res, next) => {
  try {
    if (!isValidDocId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }
    const result = await toggleUpvote(ANSWERS, req.params.id, getUserId(req.user));
    summaryCache.flushAll();
    sendUpvoteResult(res, result, 'Answer');
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/forum/answers/:id/accept
 * @desc    Accept an answer (question author, or an admin)
 * @access  Private
 */
router.post('/answers/:id/accept', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req.user);

    const answer = isValidDocId(id) ? await getRecord(ANSWERS, id) : null;
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    const question = await getRecord(QUESTIONS, answer.question_id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    if (question.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the question author can accept an answer'
      });
    }

    const siblings = await listRecords(ANSWERS, {
      filters: [{ field: 'question_id', value: answer.question_id }]
    });

    // Only one answer is accepted at a time.
    const batch = db.batch();
    siblings.forEach((sibling) => {
      if (sibling.id !== id && sibling.is_accepted) {
        batch.update(db.collection(ANSWERS).doc(sibling.id), { is_accepted: false });
      }
    });
    batch.update(db.collection(ANSWERS).doc(id), { is_accepted: true });
    batch.update(db.collection(QUESTIONS).doc(answer.question_id), { status: 'answered' });
    await batch.commit();

    summaryCache.flushAll();

    if (answer.user_id && answer.user_id !== userId) {
      await notificationService.create({
        userId: answer.user_id,
        title: 'Your answer was accepted',
        message: `Your answer to "${question.title}" was marked as the solution.`,
        type: 'forum',
        link: '/dashboard/student-forum.html',
        metadata: { questionId: answer.question_id, answerId: id }
      });
    }

    res.json({
      success: true,
      message: 'Answer accepted',
      is_accepted: true
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
