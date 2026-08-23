const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const {
  createRecord,
  findOne,
  getRecord,
  listRecords,
  deleteRecord
} = require('../services/firebase-data.service');
const { getUploadsBaseDir } = require('../utils/uploads-dir.util');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(getUploadsBaseDir(), 'notes');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|ppt|pptx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, DOC, DOCX, PPT, PPTX, and TXT files are allowed!'));
  }
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getUserMap(users = []) {
  return new Map(users.map((user) => [user.id, user.name]));
}

async function enrichNotes(notes, userId) {
  const [users, downloads, favorites] = await Promise.all([
    listRecords('users'),
    listRecords('note_downloads'),
    listRecords('note_favorites')
  ]);

  const userNameById = getUserMap(users);
  const downloadCountById = downloads.reduce((map, item) => {
    map.set(item.note_id, (map.get(item.note_id) || 0) + 1);
    return map;
  }, new Map());
  const favoriteSet = new Set(favorites.filter((item) => item.user_id === userId).map((item) => item.note_id));

  return notes.map((note) => ({
    ...note,
    uploaded_by_name: userNameById.get(note.uploaded_by) || null,
    uploader_role: users.find((user) => user.id === note.uploaded_by)?.role || null,
    downloads: downloadCountById.get(note.id) || 0,
    is_favorited: favoriteSet.has(note.id),
    file_type: path.extname(note.file_path || note.file_name || '').toUpperCase().replace('.', ''),
    file_size: note.file_size || 'Unknown'
  }));
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { branch, semester, type, search, subject } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let notes = await listRecords('notes', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    notes = notes.filter((note) => note.status === 'approved');
    if (branch) notes = notes.filter((note) => note.branch === branch);
    if (semester) notes = notes.filter((note) => toNumber(note.semester, null) === toNumber(semester, null));
    if (type) notes = notes.filter((note) => note.type === type);
    if (subject) notes = notes.filter((note) => String(note.subject || '').toLowerCase().includes(String(subject).toLowerCase()));
    if (search) {
      const q = String(search).toLowerCase();
      notes = notes.filter((note) =>
        String(note.title || '').toLowerCase().includes(q)
        || String(note.subject || '').toLowerCase().includes(q)
        || String(note.description || '').toLowerCase().includes(q)
      );
    }

    if (userRole === 'student' && !branch) {
      const userBranch = req.user.department || req.user.branch;
      if (userBranch) {
        notes = notes.filter((note) => note.branch === userBranch);
      }
    }

    const enriched = await enrichNotes(notes, userId);
    res.json({ success: true, notes: enriched });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notes' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [notes, downloads, favorites] = await Promise.all([
      listRecords('notes'),
      listRecords('note_downloads'),
      listRecords('note_favorites')
    ]);

    const approvedNotes = notes.filter((note) => note.status === 'approved');
    res.json({
      success: true,
      totalNotes: approvedNotes.length,
      downloadedNotes: new Set(downloads.filter((item) => item.user_id === userId).map((item) => item.note_id)).size,
      savedNotes: favorites.filter((item) => item.user_id === userId).length,
      totalSubjects: new Set(approvedNotes.map((note) => note.subject).filter(Boolean)).size
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const note = await getRecord('notes', req.params.id);
    if (!note || note.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    const [enriched] = await enrichNotes([note], req.user.id);
    res.json({ success: true, note: enriched });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch note details' });
  }
});

router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const note = await getRecord('notes', req.params.id);
    if (!note || note.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    const filePath = path.join(getUploadsBaseDir(), 'notes', path.basename(note.file_path));
    try {
      await fs.access(filePath);
    } catch (_) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    await createRecord('note_downloads', {
      note_id: req.params.id,
      user_id: req.user.id,
      downloaded_at: new Date().toISOString()
    });

    res.download(filePath, `${note.title}${path.extname(note.file_path)}`);
  } catch (error) {
    console.error('Error downloading note:', error);
    res.status(500).json({ success: false, message: 'Failed to download note' });
  }
});

router.get('/:id/view', authMiddleware, async (req, res) => {
  try {
    const note = await getRecord('notes', req.params.id);
    if (!note || note.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({
      success: true,
      viewUrl: `/uploads/notes/${path.basename(note.file_path)}`
    });
  } catch (error) {
    console.error('Error viewing note:', error);
    res.status(500).json({ success: false, message: 'Failed to view note' });
  }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { title, subject, branch, semester, type, description } = req.body;

    if (!['teacher', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only teachers and admins can upload notes' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const stats = await fs.stat(req.file.path);
    const fileSizeMB = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
    const note = await createRecord('notes', {
      title,
      subject,
      branch,
      semester: toNumber(semester, null),
      type,
      description: description || '',
      file_path: req.file.filename,
      file_size: fileSizeMB,
      uploaded_by: req.user.id,
      status: 'approved'
    });

    res.json({
      success: true,
      message: 'Note uploaded successfully',
      noteId: note.id
    });
  } catch (error) {
    console.error('Error uploading note:', error);
    res.status(500).json({ success: false, message: 'Failed to upload note' });
  }
});

router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const existing = await findOne('note_favorites', {
      filters: [
        { field: 'note_id', value: req.params.id },
        { field: 'user_id', value: req.user.id }
      ]
    });

    if (existing) {
      await deleteRecord('note_favorites', existing.id);
      return res.json({ success: true, message: 'Removed from favorites', is_favorited: false });
    }

    await createRecord('note_favorites', {
      note_id: req.params.id,
      user_id: req.user.id
    });
    res.json({ success: true, message: 'Added to favorites', is_favorited: true });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Failed to update favorite' });
  }
});

router.get('/favorites/list', authMiddleware, async (req, res) => {
  try {
    const favorites = await listRecords('note_favorites', {
      filters: [{ field: 'user_id', value: req.user.id }],
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });
    const noteIds = new Set(favorites.map((item) => item.note_id));
    const notes = await listRecords('notes', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    const enriched = await enrichNotes(notes.filter((note) => noteIds.has(note.id) && note.status === 'approved'), req.user.id);
    res.json({ success: true, favorites: enriched });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
});

module.exports = router;
