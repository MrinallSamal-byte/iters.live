const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  createRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortPapers(items = [], sortBy = 'newest') {
  const sorted = [...items];
  switch (sortBy) {
    case 'oldest':
      return sorted.sort((left, right) => {
        const yearDiff = toNumber(left.year, 0) - toNumber(right.year, 0);
        if (yearDiff !== 0) return yearDiff;
        return String(left.uploaded_at || '').localeCompare(String(right.uploaded_at || ''));
      });
    case 'popular':
      return sorted.sort((left, right) => toNumber(right.downloads, 0) - toNumber(left.downloads, 0));
    case 'subject':
      return sorted.sort((left, right) => String(left.subject || '').localeCompare(String(right.subject || '')));
    default:
      return sorted.sort((left, right) => {
        const yearDiff = toNumber(right.year, 0) - toNumber(left.year, 0);
        if (yearDiff !== 0) return yearDiff;
        return String(right.uploaded_at || '').localeCompare(String(left.uploaded_at || ''));
      });
  }
}

router.get('/papers', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      year,
      semester,
      examType,
      search,
      sortBy = 'newest'
    } = req.query;

    let papers = await listRecords('pyq_papers');
    if (subject) papers = papers.filter((paper) => String(paper.subject || '').toLowerCase().includes(String(subject).replace(/-/g, ' ').toLowerCase()));
    if (year) papers = papers.filter((paper) => toNumber(paper.year, null) === toNumber(year, null));
    if (semester) papers = papers.filter((paper) => toNumber(paper.semester, null) === toNumber(semester, null));
    if (examType) papers = papers.filter((paper) => paper.exam_type === examType);
    if (search) {
      const queryText = String(search).toLowerCase();
      papers = papers.filter((paper) =>
        String(paper.subject || '').toLowerCase().includes(queryText)
        || String(paper.subject_code || '').toLowerCase().includes(queryText)
      );
    }

    const users = await listRecords('users');
    const userNameById = new Map(users.map((user) => [user.id, user.name]));

    const sorted = sortPapers(papers, sortBy).map((paper) => ({
      ...paper,
      uploaded_by: userNameById.get(paper.uploaded_by) || paper.uploaded_by || null
    }));

    const pageNum = toNumber(page, 1);
    const limitNum = toNumber(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    res.json({
      success: true,
      papers: sorted.slice(offset, offset + limitNum),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: sorted.length,
        totalPages: Math.ceil(sorted.length / limitNum)
      }
    });
  } catch (error) {
    console.error('PYQ papers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch papers' });
  }
});

router.get('/papers/:id', async (req, res) => {
  try {
    const paper = await getRecord('pyq_papers', req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, message: 'Paper not found' });
    }

    const user = paper.uploaded_by ? await getRecord('users', paper.uploaded_by) : null;
    res.json({
      success: true,
      paper: {
        ...paper,
        uploaded_by_name: user?.name || null
      }
    });
  } catch (error) {
    console.error('Get paper error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch paper' });
  }
});

router.post('/papers/:id/download', async (req, res) => {
  try {
    const paper = await getRecord('pyq_papers', req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, message: 'Paper not found' });
    }

    const downloads = toNumber(paper.downloads, 0) + 1;
    await updateRecord('pyq_papers', req.params.id, { downloads });

    res.json({
      success: true,
      fileUrl: paper.file_url,
      downloads
    });
  } catch (error) {
    console.error('Download track error:', error);
    res.status(500).json({ success: false, message: 'Failed to process download' });
  }
});

router.post('/papers', verifyToken, async (req, res) => {
  try {
    const {
      subject,
      subjectCode,
      year,
      semester,
      examType,
      duration,
      maxMarks,
      fileUrl,
      hasSolution
    } = req.body;

    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and teachers can upload papers' });
    }

    if (!subject || !year || !semester || !examType) {
      return res.status(400).json({ success: false, message: 'Subject, year, semester, and exam type are required' });
    }

    const paper = await createRecord('pyq_papers', {
      subject,
      subject_code: subjectCode || null,
      year: toNumber(year, null),
      semester: toNumber(semester, null),
      exam_type: examType,
      duration: duration || null,
      max_marks: toNumber(maxMarks, null),
      file_url: fileUrl || null,
      has_solution: Boolean(hasSolution),
      downloads: 0,
      uploaded_by: req.user.id,
      uploaded_at: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      paper,
      message: 'Paper uploaded successfully'
    });
  } catch (error) {
    console.error('Upload paper error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload paper' });
  }
});

router.post('/requests', verifyToken, async (req, res) => {
  try {
    const { subject, year, examType } = req.body;
    if (!subject || !year) {
      return res.status(400).json({ success: false, message: 'Subject and year are required' });
    }

    const request = await createRecord('pyq_requests', {
      user_id: req.user.id,
      subject,
      year: toNumber(year, null),
      exam_type: examType || null,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      request,
      message: 'Request submitted successfully'
    });
  } catch (error) {
    console.error('Paper request error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit request' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const papers = await listRecords('pyq_papers');
    const years = papers.map((paper) => toNumber(paper.year, null)).filter((value) => value != null);

    res.json({
      success: true,
      stats: {
        totalPapers: papers.length,
        totalSubjects: new Set(papers.map((paper) => paper.subject).filter(Boolean)).size,
        yearRange: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : 'N/A',
        totalDownloads: papers.reduce((sum, paper) => sum + toNumber(paper.downloads, 0), 0)
      }
    });
  } catch (error) {
    console.error('PYQ stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

router.get('/subjects', async (req, res) => {
  try {
    const papers = await listRecords('pyq_papers');
    const grouped = new Map();

    for (const paper of papers) {
      const key = `${paper.subject || ''}::${paper.subject_code || ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          subject: paper.subject,
          subject_code: paper.subject_code || null,
          paper_count: 0
        });
      }
      grouped.get(key).paper_count += 1;
    }

    res.json({
      success: true,
      subjects: Array.from(grouped.values()).sort((left, right) => String(left.subject || '').localeCompare(String(right.subject || '')))
    });
  } catch (error) {
    console.error('PYQ subjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
});

module.exports = router;
