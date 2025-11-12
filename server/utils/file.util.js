/**
 * File Utility Functions
 * Provides checksum calculation and file validation
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Calculate SHA256 checksum for a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Hex checksum
 */
async function calculateChecksum(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (error) {
        throw new Error(`Failed to calculate checksum: ${error.message}`);
    }
}

/**
 * Calculate checksum from buffer
 * @param {Buffer} buffer - File buffer
 * @returns {string} - Hex checksum
 */
function calculateChecksumFromBuffer(buffer) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    return hashSum.digest('hex');
}

/**
 * Validate file mime type
 * @param {string} mime - MIME type to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {boolean}
 */
function validateMimeType(mime, allowedTypes) {
    return allowedTypes.includes(mime);
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename with UUID
 */
function generateUniqueFilename(originalName) {
    const ext = path.extname(originalName);
    const uuid = crypto.randomUUID();
    return `${uuid}${ext}`;
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Get file extension from mime type
 * @param {string} mime - MIME type
 * @returns {string} - File extension with dot
 */
function getExtensionFromMime(mime) {
    const mimeToExt = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };
    return mimeToExt[mime] || '';
}

/**
 * Format file size to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Delete file safely
 * @param {string} filePath - Path to file
 */
async function deleteFile(filePath) {
    try {
        if (await fileExists(filePath)) {
            await fs.unlink(filePath);
        }
    } catch (error) {
        console.error(`Failed to delete file ${filePath}:`, error.message);
    }
}

module.exports = {
    calculateChecksum,
    calculateChecksumFromBuffer,
    validateMimeType,
    generateUniqueFilename,
    sanitizeFilename,
    getExtensionFromMime,
    formatFileSize,
    fileExists,
    ensureDir,
    deleteFile
};
