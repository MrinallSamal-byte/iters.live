const path = require('path');
const fs = require('fs').promises;
const {
  createRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');
const { emitToUser } = require('../socket/socket');

function canAccessAdmitCard(requester, studentId) {
  return requester.role === 'admin' || requester.role === 'teacher' || String(requester.id) === String(studentId);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function findAdmitCardRecord(studentId) {
  const records = await listRecords('admit_cards', {
    filters: [{ field: 'student_id', value: String(studentId) }],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    limit: 1
  });

  return records[0] || null;
}

async function findAdmitCardFile(studentId, registrationNumber, metadata = null) {
  const candidates = [];

  if (metadata?.file_path) {
    candidates.push({
      filePath: metadata.file_path,
      fileName: metadata.file_name || path.basename(metadata.file_path)
    });
  }

  const uploadsDir = require('../utils/uploads-dir.util').ensureUploadsDir('admitcards');
  const files = await fs.readdir(uploadsDir).catch(() => []);
  const candidate = files.find((file) => {
    if (!/\.(pdf|png|jpe?g)$/i.test(file)) {
      return false;
    }
    return file.includes(String(studentId)) || (registrationNumber && file.includes(String(registrationNumber)));
  }) || files[0];

  if (candidate) {
    candidates.push({
      filePath: path.join(uploadsDir, candidate),
      fileName: candidate
    });
  }

  for (const item of candidates) {
    if (item?.filePath && await pathExists(item.filePath)) {
      return item;
    }
  }

  return null;
}

async function getAdmitCard(req, res) {
  try {
    const { student_id: studentId } = req.params;

    if (!canAccessAdmitCard(req.user, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this admit card'
      });
    }

    const [student, admitCard] = await Promise.all([
      getRecord('users', studentId),
      findAdmitCardRecord(studentId)
    ]);

    const fileInfo = await findAdmitCardFile(studentId, student?.registration_number, admitCard);

    if (!admitCard && !fileInfo) {
      return res.status(404).json({
        success: false,
        error: 'No admit card found for this student'
      });
    }

    const stats = fileInfo ? await fs.stat(fileInfo.filePath).catch(() => null) : null;
    const ext = fileInfo?.fileName ? path.extname(fileInfo.fileName).toLowerCase() : '';
    const mime = ext === '.pdf' ? 'application/pdf'
      : ext === '.png' ? 'image/png'
      : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
      : 'application/octet-stream';

    const payload = {
      id: admitCard?.id || `admitcard-${studentId}`,
      student_id: String(studentId),
      student_name: student?.name || student?.full_name || null,
      registration_number: student?.registration_number || null,
      department: student?.department || null,
      year: student?.year ?? null,
      section: student?.section || null,
      exam_code: admitCard?.exam_code || 'SEM',
      exam_name: admitCard?.exam_name || 'Semester Examination',
      exam_date: admitCard?.exam_date || null,
      file_name: fileInfo?.fileName || admitCard?.file_name || null,
      mime,
      size: stats?.size || admitCard?.size || 0,
      download_count: admitCard?.download_count || 0,
      public_url: fileInfo?.fileName ? `/uploads/admitcards/${encodeURIComponent(fileInfo.fileName)}` : null,
      download_url: `/api/admitcard/${encodeURIComponent(studentId)}/download`,
      created_at: admitCard?.created_at || null
    };

    return res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('Get admit card error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch admit card'
    });
  }
}

async function downloadAdmitCard(req, res) {
  try {
    const { student_id: studentId } = req.params;

    if (!canAccessAdmitCard(req.user, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to download this admit card'
      });
    }

    const [student, admitCard] = await Promise.all([
      getRecord('users', studentId),
      findAdmitCardRecord(studentId)
    ]);
    const fileInfo = await findAdmitCardFile(studentId, student?.registration_number, admitCard);

    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        error: 'Admit card file not found on server'
      });
    }

    if (admitCard) {
      await updateRecord('admit_cards', admitCard.id, {
        download_count: Number(admitCard.download_count || 0) + 1
      }).catch(() => {});
    }

    return res.download(fileInfo.filePath, fileInfo.fileName);
  } catch (error) {
    console.error('Download admit card error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download admit card'
    });
  }
}

async function uploadAdmitCard(req, res) {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and teachers can upload admit cards'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const studentId = String(req.body.student_id || req.body.registration_number || '').trim();
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'student_id is required'
      });
    }

    const existing = await findAdmitCardRecord(studentId);
    const payload = {
      student_id: studentId,
      exam_code: req.body.exam_code || 'SEM',
      exam_name: req.body.exam_name || 'Semester Examination',
      exam_date: req.body.exam_date || null,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      mime_type: req.file.mimetype,
      size: req.file.size,
      uploaded_by: req.user.id,
      download_count: existing?.download_count || 0
    };

    let admitCardId = existing?.id || `admitcard-${studentId}`;
    if (existing) {
      await updateRecord('admit_cards', admitCardId, payload);
    } else {
      const created = await createRecord('admit_cards', payload, { id: admitCardId });
      admitCardId = created.id;
    }

    emitToUser(studentId, 'admitcard:uploaded', {
      studentId,
      admitCardId,
      fileName: req.file.filename
    });

    return res.status(201).json({
      success: true,
      message: 'Admit card uploaded successfully',
      data: {
        id: admitCardId,
        student_id: studentId,
        fileName: req.file.filename,
        originalName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Upload admit card error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload admit card'
    });
  }
}

module.exports = {
  getAdmitCard,
  downloadAdmitCard,
  uploadAdmitCard
};
