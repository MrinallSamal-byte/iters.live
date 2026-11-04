/**
 * Profile Controller
 * Handles user profile operations: view, update, photo upload
 */

const { db } = require('../database/firebase');
const path = require('path');
const fs = require('fs').promises;
const { getPortalSnapshotForUser } = require('../services/soa-data.service');

/**
 * GET /api/users/me
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
    try {
        // req.user is already populated by authMiddleware from Firestore
        const user = req.user;
        let portalSnapshot = null;

        // Remove sensitive data
        const safeUser = { ...user };
        delete safeUser.password;

        // If student, fetch admit card (mock implementation for now as we migrate)
        if (user.role === 'student') {
            // TODO: Fetch admit card from Firestore 'admit_cards' collection
            safeUser.admit_card = null;
            try {
                portalSnapshot = await getPortalSnapshotForUser({
                    userId: user.id,
                    registrationNumber: user.registration_number
                });
                safeUser.portal = portalSnapshot.status;
                safeUser.portalProfile = portalSnapshot.normalizedData?.profile || null;
            } catch (_) {
                safeUser.portal = null;
                safeUser.portalProfile = null;
            }
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

// updateProfile input rules: the values are stored verbatim in Firestore otherwise.
const PHONE_REGEX = /^[+\d][\d\s-]{0,19}$/;
const SOCIAL_LINK_KEYS = ['linkedin', 'github', 'twitter', 'instagram', 'website'];

const isValidHttpUrl = (value) => {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
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

        if (phone !== undefined && (typeof phone !== 'string' || !PHONE_REGEX.test(phone))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone: must be a string of up to 20 digits, optionally starting with +, with spaces or dashes allowed'
            });
        }

        if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bio: must be a string of at most 500 characters'
            });
        }

        let normalizedSkills;
        if (skills !== undefined) {
            if (Array.isArray(skills)) {
                if (skills.length > 20 || skills.some((skill) => typeof skill !== 'string' || skill.length > 50)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid skills: an array may contain at most 20 strings of at most 50 characters each'
                    });
                }
                normalizedSkills = skills;
            } else if (typeof skills === 'string') {
                normalizedSkills = skills.split(',').map((skill) => skill.trim()).filter(Boolean);
                if (normalizedSkills.length > 20 || normalizedSkills.some((skill) => skill.length > 50)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid skills: at most 20 skills of at most 50 characters each'
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid skills: must be an array of strings or a comma-separated string'
                });
            }
        }

        if (social_links !== undefined) {
            if (typeof social_links !== 'object' || social_links === null || Array.isArray(social_links)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid social_links: must be an object'
                });
            }
            const keys = Object.keys(social_links);
            if (keys.some((key) => !SOCIAL_LINK_KEYS.includes(key))) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid social_links: allowed keys are ${SOCIAL_LINK_KEYS.join(', ')}`
                });
            }
            if (keys.some((key) => !isValidHttpUrl(social_links[key]))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid social_links: each value must be an http(s) URL of at most 2048 characters'
                });
            }
        }

        const updateData = {};
        if (phone !== undefined) updateData.phone_number = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (skills !== undefined) updateData.skills = normalizedSkills;
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
