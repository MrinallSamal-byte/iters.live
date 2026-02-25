/**
 * Profile Controller
 * Handles user profile operations: view, update, photo upload
 */

const { db } = require('../database/firebase');
const path = require('path');
const fs = require('fs').promises;

/**
 * GET /api/users/me
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
    try {
        // req.user is already populated by authMiddleware from Firestore
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Remove sensitive data
        const safeUser = { ...user };
        delete safeUser.password;

        // If student, fetch admit card (mock implementation for now as we migrate)
        if (user.role === 'student') {
            // TODO: Fetch admit card from Firestore 'admit_cards' collection
            safeUser.admit_card = null;
        }

        res.json({
            success: true,
            data: safeUser
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
        const { phone, bio, skills, social_links } = req.body;

        const updateData = {};
        if (phone !== undefined) updateData.phone_number = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (skills !== undefined) updateData.skills = skills;
        if (social_links !== undefined) updateData.social_links = social_links;

        updateData.updated_at = new Date();

        if (Object.keys(updateData).length > 0) {
            await db.collection('users').doc(userId).update(updateData);
        }

        // Return updated user
        const updatedUserDoc = await db.collection('users').doc(userId).get();
        const updatedUser = updatedUserDoc.data();
        delete updatedUser.password;
        updatedUser.id = updatedUserDoc.id;

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
        const publicUrl = `/uploads/avatars/${file.filename}`;

        // Update user profile_pic in Firestore
        await db.collection('users').doc(userId).update({
            profile_picture: publicUrl,
            updated_at: new Date()
        });

        // Log activity (optional, skipping for now to simplify migration)

        res.json({
            success: true,
            message: 'Profile photo updated successfully',
            data: {
                profile_pic: publicUrl
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
        const defaultPic = '/uploads/avatars/default-avatar.png';

        await db.collection('users').doc(userId).update({
            profile_picture: defaultPic,
            updated_at: new Date()
        });

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
