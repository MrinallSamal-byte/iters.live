/**
 * Google Drive Backup Service
 * Handles backup storage to Google Drive as JSON files
 * 
 * Target folder ID is configurable via GOOGLE_DRIVE_FOLDER_ID environment variable
 * Default folder: https://drive.google.com/drive/folders/16K2jlOyy7GgLcfGebmus-kCuG0BF_k-6
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration - folder ID can be set via environment variable
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '16K2jlOyy7GgLcfGebmus-kCuG0BF_k-6';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive'
];

// Initialize auth
let auth = null;
let driveClient = null;

/**
 * Initialize Google API authentication
 * Supports both Service Account JSON file and environment variable
 */
async function initializeAuth() {
  if (auth) return auth;

  try {
    let credentials;

    // Try to load credentials from environment variable first
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } else {
      // Try to load from file
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                              path.join(__dirname, '../googleServiceAccount.json');
      try {
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        credentials = JSON.parse(fileContent);
      } catch (e) {
        console.warn('Google Drive Backup: No service account credentials found');
        return null;
      }
    }

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES
    });

    driveClient = google.drive({ version: 'v3', auth });

    console.log('✓ Google Drive Backup service initialized');
    return auth;
  } catch (error) {
    console.error('Google Drive Backup initialization error:', error.message);
    return null;
  }
}

/**
 * Find or create a folder for a user in the backup folder
 * @param {string} userId - User's registration number or ID
 * @returns {string|null} - Folder ID or null if failed
 */
async function findOrCreateUserFolder(userId) {
  await initializeAuth();
  if (!driveClient) {
    console.warn('Google Drive client not initialized');
    return null;
  }

  try {
    const folderName = `User_${userId}`;

    // Search for existing folder in the parent folder
    const searchResponse = await driveClient.files.list({
      q: `name='${folderName}' and '${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      console.log(`Found existing folder for user: ${userId}`);
      return searchResponse.data.files[0].id;
    }

    // Create new folder
    const createResponse = await driveClient.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [GOOGLE_DRIVE_FOLDER_ID]
      },
      fields: 'id'
    });

    console.log(`Created new folder for user: ${userId}`);
    return createResponse.data.id;
  } catch (error) {
    console.error('Error finding/creating user folder:', error.message);
    return null;
  }
}

/**
 * Save user data as JSON to Google Drive
 * Creates/overwrites latest.json in user's folder
 * @param {string} userId - User's registration number or ID
 * @param {Object} data - Scraped data to save
 * @returns {boolean} - Success status
 */
async function saveUserBackup(userId, data) {
  try {
    const folderId = await findOrCreateUserFolder(userId);
    if (!folderId) {
      console.warn('Could not get/create folder for user:', userId);
      return false;
    }

    // Add metadata to the backup
    const backupData = {
      ...data,
      backupMetadata: {
        userId,
        savedAt: new Date().toISOString(),
        version: '2.0.0',
        source: 'SOA Portal Scraper'
      }
    };

    const jsonContent = JSON.stringify(backupData, null, 2);
    const fileName = 'latest.json';

    // Check if file already exists
    const searchResponse = await driveClient.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // Update existing file
      const fileId = searchResponse.data.files[0].id;
      await driveClient.files.update({
        fileId,
        media: {
          mimeType: 'application/json',
          body: jsonContent
        }
      });
      console.log(`Updated backup for user: ${userId}`);
    } else {
      // Create new file
      await driveClient.files.create({
        resource: {
          name: fileName,
          parents: [folderId]
        },
        media: {
          mimeType: 'application/json',
          body: jsonContent
        },
        fields: 'id'
      });
      console.log(`Created new backup for user: ${userId}`);
    }

    // Also save a timestamped backup (keep last 5)
    await saveTimestampedBackup(folderId, userId, jsonContent);

    return true;
  } catch (error) {
    console.error('Error saving backup to Google Drive:', error.message);
    return false;
  }
}

/**
 * Save a timestamped backup and clean up old ones
 * @param {string} folderId - User's folder ID
 * @param {string} userId - User ID
 * @param {string} content - JSON content
 */
async function saveTimestampedBackup(folderId, userId, content) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.json`;

    // Create timestamped backup
    await driveClient.files.create({
      resource: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: 'application/json',
        body: content
      },
      fields: 'id'
    });

    // Clean up old backups (keep only last 5)
    const listResponse = await driveClient.files.list({
      q: `name contains 'backup_' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      spaces: 'drive'
    });

    const files = listResponse.data.files || [];
    if (files.length > 5) {
      // Delete oldest files (beyond first 5)
      for (let i = 5; i < files.length; i++) {
        await driveClient.files.delete({ fileId: files[i].id });
      }
    }
  } catch (error) {
    // Non-critical error, just log it
    console.warn('Error saving timestamped backup:', error.message);
  }
}

/**
 * Load user backup data from Google Drive
 * @param {string} userId - User's registration number or ID
 * @returns {Object|null} - User data or null if not found
 */
async function loadUserBackup(userId) {
  await initializeAuth();
  if (!driveClient) {
    console.warn('Google Drive client not initialized');
    return null;
  }

  try {
    const folderId = await findOrCreateUserFolder(userId);
    if (!folderId) {
      return null;
    }

    // Search for latest.json in user's folder
    const searchResponse = await driveClient.files.list({
      q: `name='latest.json' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
      console.log(`No backup found for user: ${userId}`);
      return null;
    }

    const fileId = searchResponse.data.files[0].id;

    // Download file content
    const downloadResponse = await driveClient.files.get({
      fileId,
      alt: 'media'
    });

    const data = downloadResponse.data;
    console.log(`Loaded backup for user: ${userId}`);

    // Return the data (it might be a string or already parsed object)
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data;
  } catch (error) {
    console.error('Error loading backup from Google Drive:', error.message);
    return null;
  }
}

/**
 * Check if backup exists for a user
 * @param {string} userId - User's registration number or ID
 * @returns {boolean} - True if backup exists
 */
async function backupExists(userId) {
  await initializeAuth();
  if (!driveClient) {
    return false;
  }

  try {
    const folderId = await findOrCreateUserFolder(userId);
    if (!folderId) {
      return false;
    }

    const searchResponse = await driveClient.files.list({
      q: `name='latest.json' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive'
    });

    return searchResponse.data.files && searchResponse.data.files.length > 0;
  } catch (error) {
    console.warn('Error checking backup existence:', error.message);
    return false;
  }
}

/**
 * Check if Google Drive service is available
 * @returns {boolean} - True if service is initialized
 */
async function isAvailable() {
  await initializeAuth();
  return !!driveClient;
}

/**
 * Get backup metadata (last updated time, etc.)
 * @param {string} userId - User's registration number or ID
 * @returns {Object|null} - Metadata or null
 */
async function getBackupMetadata(userId) {
  await initializeAuth();
  if (!driveClient) {
    return null;
  }

  try {
    const folderId = await findOrCreateUserFolder(userId);
    if (!folderId) {
      return null;
    }

    const searchResponse = await driveClient.files.list({
      q: `name='latest.json' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime, size)',
      spaces: 'drive'
    });

    if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
      return null;
    }

    const file = searchResponse.data.files[0];
    return {
      fileId: file.id,
      fileName: file.name,
      lastModified: file.modifiedTime,
      size: file.size
    };
  } catch (error) {
    console.warn('Error getting backup metadata:', error.message);
    return null;
  }
}

module.exports = {
  initializeAuth,
  saveUserBackup,
  loadUserBackup,
  backupExists,
  isAvailable,
  getBackupMetadata,
  findOrCreateUserFolder,
  GOOGLE_DRIVE_FOLDER_ID
};
