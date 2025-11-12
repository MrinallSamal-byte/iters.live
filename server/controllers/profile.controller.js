/**
 * Profile Controller
 * Handles user profile operations: view, update, photo upload
 */

const db = require('../database/db');
const { calculateChecksum, fileExists, deleteFile } = require('../utils/file.util');
const path = require('path');
const fs = require('fs').promises;

/**
 * GET /api/users/me
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const users = await db.query(
            `SELECT id, name, registration_number, email, role,
                    phone_number AS phone,
                    department, year, section,
                    profile_picture AS profile_pic,
                    created_at, updated_at
             FROM users 
             WHERE id = ? AND is_active = true`,
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const user = users[0];
        
        // Get admit card info if student
        if (user.role === 'student') {
            const admitCards = await db.query(
                `SELECT ac.*, f.public_url, f.original_name
                 FROM admit_cards ac
                 JOIN files f ON ac.file_id = f.id
                 WHERE ac.user_id = ? AND ac.is_active = true
                 ORDER BY ac.created_at DESC
                 LIMIT 1`,
                [userId]
            );
            
            user.admit_card = admitCards.length > 0 ? admitCards[0] : null;
        }
        
        res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile'
        });
    }
};

/**
 * PUT /api/users/me
 * Update current user profile
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
    const { name, phone, department, year, section } = req.body;
        
        // Validation
        if (!name || name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Name must be at least 2 characters'
            });
        }
        
        if (phone && !/^\+?[\d\s\-()]+$/.test(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (name) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (phone !== undefined) {
            updates.push('phone_number = ?');
            values.push(phone || null);
        }
        if (department) {
            updates.push('department = ?');
            values.push(department);
        }
        if (year !== undefined) {
            updates.push('year = ?');
            values.push(year);
        }
        if (section !== undefined) {
            updates.push('section = ?');
            values.push(section);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
        
        values.push(userId);
        
        await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated user
        const users = await db.query(
            `SELECT id, name, registration_number, email, role,
                    phone_number AS phone,
                    department, year, section,
                    profile_picture AS profile_pic
             FROM users 
             WHERE id = ?`,
            [userId]
        );
        
        const updatedUser = users[0];
        
        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, meta, ip_address)
             VALUES (?, 'profile_updated', 'user', ?, ?, ?)`,
            [
                userId,
                userId,
                JSON.stringify({ fields: Object.keys(req.body) }),
                req.ip
            ]
        );
        
        // Emit socket event
        if (req.app.get('io')) {
            // Emit to both legacy and standardized rooms
            req.app.get('io').to(`user-${userId}`).emit('user:updated', {
                userId: updatedUser.id,
                name: updatedUser.name,
                department: updatedUser.department,
                year: updatedUser.year,
                profile_pic: updatedUser.profile_pic
            });
            req.app.get('io').to(`user:${userId}`).emit('user:updated', {
                userId: updatedUser.id,
                name: updatedUser.name,
                department: updatedUser.department,
                year: updatedUser.year,
                profile_pic: updatedUser.profile_pic
            });
        }
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
};

/**
 * POST /api/profile/photo
 * Upload profile photo
 */
const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        
        const userId = req.user.id;
    const file = req.file;
        
        // Calculate checksum
        const checksum = await calculateChecksum(file.path);
        
        // Generate public URL
        const publicUrl = `/uploads/avatars/${file.filename}`;
        
        // Insert file record
        const fileResult = await db.query(
            `INSERT INTO files 
             (original_name, stored_name, mime, size, checksum, uploaded_by, 
              public_url, file_type, approved)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'avatar', true)`,
            [
                file.originalname,
                file.filename,
                file.mimetype,
                file.size,
                checksum,
                userId,
                publicUrl
            ]
        );
        
        const fileId = fileResult.insertId;
        
        // Get old profile pic to delete later
        const oldUserRows = await db.query(
            'SELECT profile_picture FROM users WHERE id = ?',
            [userId]
        );
        
        // Update user profile_pic
        await db.query(
            'UPDATE users SET profile_picture = ? WHERE id = ?',
            [publicUrl, userId]
        );
        
        // Delete old profile pic file if exists and not default
        if (oldUserRows[0]?.profile_picture && 
            !oldUserRows[0].profile_picture.includes('default') &&
            oldUserRows[0].profile_picture !== publicUrl) {
            try {
                const relative = oldUserRows[0].profile_picture.replace(/^\/+/,'');
                const oldPath = path.join(__dirname, '../../', relative);
                if (await fileExists(oldPath)) {
                    await deleteFile(oldPath);
                }
            } catch (err) {
                console.error('Failed to delete old profile pic:', err.message);
            }
        }
        
        // Log activity
        await db.query(
            `INSERT INTO activity_log 
             (user_id, action, entity_type, entity_id, meta, ip_address)
             VALUES (?, 'profile_photo_changed', 'file', ?, ?, ?)`,
            [
                userId,
                fileId,
                JSON.stringify({ 
                    filename: file.filename,
                    size: file.size 
                }),
                req.ip
            ]
        );
        
        // Emit socket event
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            // Get user details for socket broadcast
            const users = await db.query(
                'SELECT department, year FROM users WHERE id = ?',
                [userId]
            );
            
            // Broadcast to user's own room
            io.to(`user-${userId}`).emit('user:photo:changed', {
                userId,
                profile_pic: publicUrl
            });
            io.to(`user:${userId}`).emit('user:photo:changed', {
                userId,
                profile_pic: publicUrl
            });
            
            // Broadcast to department/year room if student/teacher
            if (users[0]?.department && users[0]?.year) {
                io.to(`dept-${users[0].department}-year-${users[0].year}`)
                  .emit('user:photo:changed', {
                      userId,
                      profile_pic: publicUrl
                  });
            }
        }
        
        res.json({
            success: true,
            message: 'Profile photo updated successfully',
            data: {
                profile_pic: publicUrl,
                file_id: fileId
            }
        });
        
    } catch (error) {
        console.error('Upload photo error:', error);
        
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
            error: 'Failed to upload photo'
        });
    }
};

/**
 * DELETE /api/profile/photo
 * Remove profile photo (set to default)
 */
const deletePhoto = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get current profile pic
        const users = await db.query(
            'SELECT profile_picture FROM users WHERE id = ?',
            [userId]
        );
        
        if (!users[0]?.profile_picture || users[0].profile_picture.includes('default')) {
            return res.status(400).json({
                success: false,
                error: 'No profile photo to delete'
            });
        }
        
        const oldPic = users[0].profile_picture;
        const defaultPic = '/uploads/avatars/default-avatar.png';
        
        // Update to default
        await db.query(
            'UPDATE users SET profile_picture = ? WHERE id = ?',
            [defaultPic, userId]
        );
        
        // Delete file
        try {
            const relative = oldPic.replace(/^\/+/,'');
            const filePath = path.join(__dirname, '../../', relative);
            if (await fileExists(filePath)) {
                await deleteFile(filePath);
            }
        } catch (err) {
            console.error('Failed to delete file:', err.message);
        }
        
        // Log activity
        await db.query(
            `INSERT INTO activity_log 
             (user_id, action, entity_type, entity_id, meta, ip_address)
             VALUES (?, 'profile_photo_deleted', 'user', ?, ?, ?)`,
            [userId, userId, JSON.stringify({ old_pic: oldPic }), req.ip]
        );
        
        res.json({
            success: true,
            message: 'Profile photo removed',
            data: { profile_pic: defaultPic }
        });
        
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete photo'
        });
    }
};

module.exports = {
    getCurrentUser,
    updateProfile,
    uploadPhoto,
    deletePhoto
};
