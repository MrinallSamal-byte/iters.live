/**
 * Admit Card Controller
 * Handles admit card / ID card viewing and downloading
 */

const db = require('../database/db');
const path = require('path');
const fs = require('fs').promises;

/**
 * GET /api/admitcard/:student_id
 * Get admit card details for preview
 */
const getAdmitCard = async (req, res) => {
    try {
        const { student_id } = req.params;
        const requesterId = req.user.id;
        const requesterRole = req.user.role;
        
        // Authorization check
        const canView = 
            requesterRole === 'admin' || 
            requesterRole === 'teacher' || 
            parseInt(student_id) === requesterId;
        
        if (!canView) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this admit card'
            });
        }
        
        // Get admit card with file details
        const [admitCards] = await db.query(
            `SELECT 
                ac.id, ac.exam_code, ac.exam_name, ac.exam_date, ac.created_at,
                f.id as file_id, f.original_name, f.mime, f.size, 
                f.public_url, f.download_count,
                u.name as student_name, u.registration_number, 
                u.department, u.year, u.section
             FROM admit_cards ac
             JOIN files f ON ac.file_id = f.id
             JOIN users u ON ac.user_id = u.id
             WHERE ac.user_id = ? AND ac.is_active = true
             ORDER BY ac.created_at DESC
             LIMIT 1`,
            [student_id]
        );
        
        if (admitCards.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No admit card found for this student'
            });
        }
        
        const admitCard = admitCards[0];
        
        res.json({
            success: true,
            data: admitCard
        });
        
    } catch (error) {
        console.error('Get admit card error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch admit card'
        });
    }
};

/**
 * GET /api/admitcard/:student_id/download
 * Download admit card PDF
 */
const downloadAdmitCard = async (req, res) => {
    try {
        const { student_id } = req.params;
        const requesterId = req.user.id;
        const requesterRole = req.user.role;
        
        // Authorization check
        const canDownload = 
            requesterRole === 'admin' || 
            requesterRole === 'teacher' || 
            parseInt(student_id) === requesterId;
        
        if (!canDownload) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to download this admit card'
            });
        }
        
        // Get admit card file
        const [admitCards] = await db.query(
            `SELECT 
                ac.id as admit_card_id, ac.exam_code,
                f.id as file_id, f.stored_name, f.original_name, 
                f.mime, f.public_url,
                u.registration_number
             FROM admit_cards ac
             JOIN files f ON ac.file_id = f.id
             JOIN users u ON ac.user_id = u.id
             WHERE ac.user_id = ? AND ac.is_active = true
             ORDER BY ac.created_at DESC
             LIMIT 1`,
            [student_id]
        );
        
        if (admitCards.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No admit card found'
            });
        }
        
        const admitCard = admitCards[0];
        const filePath = path.join(__dirname, '../../uploads/admitcards/', admitCard.stored_name);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                error: 'Admit card file not found on server'
            });
        }
        
        // Increment download count
        await db.query(
            'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
            [admitCard.file_id]
        );
        
        // Log activity
        await db.query(
            `INSERT INTO activity_log 
             (user_id, action, entity_type, entity_id, meta, ip_address)
             VALUES (?, 'admitcard_downloaded', 'admit_card', ?, ?, ?)`,
            [
                requesterId,
                admitCard.admit_card_id,
                JSON.stringify({ 
                    student_id,
                    exam_code: admitCard.exam_code 
                }),
                req.ip
            ]
        );
        
        // Set response headers for download
        const downloadName = `AdmitCard_${admitCard.registration_number}_${admitCard.exam_code}.pdf`;
        
        res.setHeader('Content-Type', admitCard.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream file
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Download admit card error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download admit card'
        });
    }
};

/**
 * POST /api/admitcard/upload (Admin/Teacher only)
 * Upload admit card for a student
 */
const uploadAdmitCard = async (req, res) => {
    try {
        const { user_id, exam_code, exam_name, exam_date } = req.body;
        const uploaderId = req.user.id;
        const uploaderRole = req.user.role;
        
        // Only admin and teacher can upload
        if (uploaderRole !== 'admin' && uploaderRole !== 'teacher') {
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
        
        if (!user_id || !exam_code) {
            return res.status(400).json({
                success: false,
                error: 'user_id and exam_code are required'
            });
        }
        
        const file = req.file;
        const { calculateChecksum } = require('../utils/file.util');
        const checksum = await calculateChecksum(file.path);
        
        // Generate public URL
        const publicUrl = `/uploads/admitcards/${file.filename}`;
        
        // Insert file record
        const [fileResult] = await db.query(
            `INSERT INTO files 
             (original_name, stored_name, mime, size, checksum, uploaded_by, 
              public_url, file_type, approved)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'admit_card', true)`,
            [
                file.originalname,
                file.filename,
                file.mimetype,
                file.size,
                checksum,
                uploaderId,
                publicUrl
            ]
        );
        
        const fileId = fileResult.insertId;
        
        // Deactivate old admit cards for same exam
        await db.query(
            `UPDATE admit_cards 
             SET is_active = false 
             WHERE user_id = ? AND exam_code = ?`,
            [user_id, exam_code]
        );
        
        // Insert admit card record
        const [admitCardResult] = await db.query(
            `INSERT INTO admit_cards 
             (user_id, file_id, exam_code, exam_name, exam_date)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, fileId, exam_code, exam_name || null, exam_date || null]
        );
        
        // Log activity
        await db.query(
            `INSERT INTO activity_log 
             (user_id, action, entity_type, entity_id, meta, ip_address)
             VALUES (?, 'admitcard_uploaded', 'admit_card', ?, ?, ?)`,
            [
                uploaderId,
                admitCardResult.insertId,
                JSON.stringify({ 
                    student_id: user_id,
                    exam_code,
                    filename: file.filename 
                }),
                req.ip
            ]
        );
        
        // Emit socket event to notify student
        if (req.app.get('io')) {
            req.app.get('io').to(`user-${user_id}`).emit('admitcard:uploaded', {
                exam_code,
                exam_name,
                public_url: publicUrl
            });
        }
        
        res.json({
            success: true,
            message: 'Admit card uploaded successfully',
            data: {
                admit_card_id: admitCardResult.insertId,
                file_id: fileId,
                public_url: publicUrl
            }
        });
        
    } catch (error) {
        console.error('Upload admit card error:', error);
        
        // Delete uploaded file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (err) {
                console.error('Failed to delete file on error:', err.message);
            }
        }
        
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
