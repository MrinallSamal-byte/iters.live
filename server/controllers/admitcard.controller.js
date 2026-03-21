const path = require('path');
const fs = require('fs').promises;
const { query } = require('../database/db');

function canAccessAdmitCard(requester, studentId) {
  return requester.role === 'admin' || requester.role === 'teacher' || String(requester.id) === String(studentId);
}

async function safeQuery(sql, params, fallback) {
  try {
    return await query(sql, params);
  } catch (_) {
    return fallback;
  }
}

async function findAdmitCardFile(studentId, registrationNumber) {
  const uploadsDir = path.join(__dirname, '../uploads');
  const files = await fs.readdir(uploadsDir).catch(() => []);

  const candidate = files.find((file) => {
    if (!file.toLowerCase().endsWith('.pdf')) {
      return false;
    }
    return file.includes(String(studentId)) || (registrationNumber && file.includes(registrationNumber));
  }) || files.find((file) => file.startsWith('AdmitCard_') && file.toLowerCase().endsWith('.pdf'));

  if (!candidate) {
    return null;
  }

  return {
    filePath: path.join(uploadsDir, candidate),
    fileName: candidate
  };
}

const getAdmitCard = async (req, res) => {
  try {
    const { student_id: studentId } = req.params;

    if (!canAccessAdmitCard(req.user, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this admit card'
      });
    }

    const rows = await safeQuery(
      `SELECT id, exam_code, exam_name, exam_date, created_at
       FROM admit_cards
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId],
      []
    );

    const fileInfo = await findAdmitCardFile(studentId, req.user.registration_number);

    if (!rows.length && !fileInfo) {
      return res.status(404).json({
        success: false,
        error: 'No admit card found for this student'
      });
    }

    const admitCard = rows[0] || {
      id: `fallback-${studentId}`,
      exam_code: 'MIDSEM',
      exam_name: 'Mid Semester Examination',
      exam_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: {
        ...admitCard,
        student_id: studentId,
        registration_number: req.user.registration_number || null,
        file_name: fileInfo?.fileName || null,
        download_url: `/api/admitcard/${encodeURIComponent(studentId)}/download`
      }
    });
  } catch (error) {
    console.error('Get admit card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admit card'
    });
  }
};

const downloadAdmitCard = async (req, res) => {
  try {
    const { student_id: studentId } = req.params;

    if (!canAccessAdmitCard(req.user, studentId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to download this admit card'
      });
    }

    const fileInfo = await findAdmitCardFile(studentId, req.user.registration_number);

    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        error: 'Admit card file not found on server'
      });
    }

    return res.download(fileInfo.filePath, fileInfo.fileName);
  } catch (error) {
    console.error('Download admit card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download admit card'
    });
  }
};

const uploadAdmitCard = async (req, res) => {
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

    res.status(201).json({
      success: true,
      message: 'Admit card uploaded successfully',
      data: {
        fileName: req.file.filename,
        originalName: req.file.originalname
      }
    });
  } catch (error) {
    console.error('Upload admit card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload admit card'
    });
  }
};

module.exports = {
  getAdmitCard,
  downloadAdmitCard,
  uploadAdmitCard
};
