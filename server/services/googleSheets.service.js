/**
 * Google Sheets Service
 * Handles backup storage to Google Drive Sheets
 * 
 * Target folder ID is configurable via GOOGLE_DRIVE_FOLDER_ID environment variable
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration - folder ID can be set via environment variable
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '16K2jlOyy7GgLcfGebmus-kCuG0BF_k-6';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

// Initialize auth
let auth = null;
let sheetsClient = null;
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
        // Use fs.readFileSync and JSON.parse for better error handling
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        credentials = JSON.parse(fileContent);
      } catch (e) {
        // Generic error message to avoid exposing path information
        console.warn('Google Sheets: No service account credentials found');
        return null;
      }
    }

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    driveClient = google.drive({ version: 'v3', auth });

    console.log('✓ Google Sheets service initialized');
    return auth;
  } catch (error) {
    console.error('Google Sheets initialization error:', error.message);
    return null;
  }
}

/**
 * Find or create a spreadsheet for a user
 * @param {string} registrationNumber - User's registration number (used as sheet name)
 * @returns {string|null} - Spreadsheet ID or null if failed
 */
async function findOrCreateUserSheet(registrationNumber) {
  await initializeAuth();
  if (!driveClient || !sheetsClient) {
    console.warn('Google Sheets client not initialized');
    return null;
  }

  try {
    const sheetName = `Student_${registrationNumber}`;

    // Search for existing spreadsheet in the folder
    const searchResponse = await driveClient.files.list({
      q: `name='${sheetName}' and '${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      console.log(`Found existing sheet for ${registrationNumber}`);
      return searchResponse.data.files[0].id;
    }

    // Create new spreadsheet
    const createResponse = await sheetsClient.spreadsheets.create({
      resource: {
        properties: {
          title: sheetName
        },
        sheets: [
          { properties: { title: 'Profile' } },
          { properties: { title: 'Attendance' } },
          { properties: { title: 'Marks' } },
          { properties: { title: 'Timetable' } },
          { properties: { title: 'Courses' } },
          { properties: { title: 'Results' } },
          { properties: { title: 'Notifications' } },
          { properties: { title: 'Metadata' } }
        ]
      }
    });

    const spreadsheetId = createResponse.data.spreadsheetId;

    // Move to target folder
    await driveClient.files.update({
      fileId: spreadsheetId,
      addParents: GOOGLE_DRIVE_FOLDER_ID,
      fields: 'id, parents'
    });

    console.log(`Created new sheet for ${registrationNumber}: ${spreadsheetId}`);
    return spreadsheetId;
  } catch (error) {
    console.error('Error finding/creating user sheet:', error.message);
    return null;
  }
}

/**
 * Save user data to Google Sheets
 * @param {string} registrationNumber - User's registration number
 * @param {Object} data - Scraped data (profile, attendance, marks, etc.)
 * @returns {boolean} - Success status
 */
async function saveUserData(registrationNumber, data) {
  try {
    const spreadsheetId = await findOrCreateUserSheet(registrationNumber);
    if (!spreadsheetId) {
      console.warn('Could not get spreadsheet for user:', registrationNumber);
      return false;
    }

    const updateRequests = [];

    // Profile data
    if (data.profile) {
      const profileRows = [
        ['Field', 'Value'],
        ['Name', data.profile.name || ''],
        ['Registration Number', data.profile.registration_number || registrationNumber],
        ['Email', data.profile.email || ''],
        ['Department', data.profile.department || ''],
        ['Year', data.profile.year || ''],
        ['Section', data.profile.section || ''],
        ['Semester', data.profile.semester || ''],
        ['Phone', data.profile.phone || ''],
        ['Father Name', data.profile.father_name || ''],
        ['Date of Birth', data.profile.dob || '']
      ];
      updateRequests.push({
        range: 'Profile!A1:B20',
        values: profileRows
      });
    }

    // Attendance data
    if (data.attendance && Array.isArray(data.attendance)) {
      const attendanceRows = [
        ['Subject', 'Attended', 'Total', 'Percentage']
      ];
      data.attendance.forEach(item => {
        attendanceRows.push([
          item.subject || '',
          item.attended || '',
          item.total || '',
          item.percentage || ''
        ]);
      });
      updateRequests.push({
        range: 'Attendance!A1:D100',
        values: attendanceRows
      });
    }

    // Marks data
    if (data.marks && Array.isArray(data.marks)) {
      const marksRows = [
        ['Subject', 'Marks', 'Grade', 'Exam Type', 'Total Marks']
      ];
      data.marks.forEach(item => {
        marksRows.push([
          item.subject || '',
          item.marks || '',
          item.grade || '',
          item.exam_type || '',
          item.total_marks || ''
        ]);
      });
      updateRequests.push({
        range: 'Marks!A1:E100',
        values: marksRows
      });
    }

    // Timetable data
    if (data.timetable && Array.isArray(data.timetable)) {
      const timetableRows = [
        ['Day', 'Time Slot', 'Subject', 'Teacher', 'Room']
      ];
      data.timetable.forEach(item => {
        timetableRows.push([
          item.day || '',
          item.time_slot || '',
          item.subject || '',
          item.teacher || '',
          item.room || ''
        ]);
      });
      updateRequests.push({
        range: 'Timetable!A1:E100',
        values: timetableRows
      });
    }

    // Courses data
    if (data.courses && Array.isArray(data.courses)) {
      const coursesRows = [
        ['Course Code', 'Course Name', 'Credits', 'Instructor']
      ];
      data.courses.forEach(item => {
        coursesRows.push([
          item.code || '',
          item.name || '',
          item.credits || '',
          item.instructor || ''
        ]);
      });
      updateRequests.push({
        range: 'Courses!A1:D100',
        values: coursesRows
      });
    }

    // Results data
    if (data.results && Array.isArray(data.results)) {
      const resultsRows = [
        ['Semester', 'SGPA', 'CGPA', 'Credits Earned', 'Total Credits']
      ];
      data.results.forEach(item => {
        resultsRows.push([
          item.semester || '',
          item.sgpa || '',
          item.cgpa || '',
          item.credits_earned || '',
          item.total_credits || ''
        ]);
      });
      updateRequests.push({
        range: 'Results!A1:E50',
        values: resultsRows
      });
    }

    // Notifications data
    if (data.notifications && Array.isArray(data.notifications)) {
      const notificationsRows = [
        ['Title', 'Message', 'Date', 'Type']
      ];
      data.notifications.forEach(item => {
        notificationsRows.push([
          item.title || '',
          item.message || '',
          item.date || '',
          item.type || ''
        ]);
      });
      updateRequests.push({
        range: 'Notifications!A1:D100',
        values: notificationsRows
      });
    }

    // Metadata
    updateRequests.push({
      range: 'Metadata!A1:B10',
      values: [
        ['Field', 'Value'],
        ['Last Updated', new Date().toISOString()],
        ['Registration Number', registrationNumber],
        ['Data Source', 'SOA Portal Scraper'],
        ['Version', '2.0.0']
      ]
    });

    // Clear existing data and update with new data
    for (const request of updateRequests) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: request.range,
        valueInputOption: 'RAW',
        resource: {
          values: request.values
        }
      });
    }

    console.log(`Data saved to Google Sheets for ${registrationNumber}`);
    return true;
  } catch (error) {
    console.error('Error saving to Google Sheets:', error.message);
    return false;
  }
}

/**
 * Load user data from Google Sheets (backup fallback)
 * @param {string} registrationNumber - User's registration number
 * @returns {Object|null} - User data or null if not found
 */
async function loadUserData(registrationNumber) {
  await initializeAuth();
  if (!sheetsClient) {
    console.warn('Google Sheets client not initialized');
    return null;
  }

  try {
    const spreadsheetId = await findOrCreateUserSheet(registrationNumber);
    if (!spreadsheetId) {
      return null;
    }

    const result = {
      profile: {},
      attendance: [],
      marks: [],
      timetable: [],
      courses: [],
      results: [],
      notifications: [],
      lastUpdated: null
    };

    // Load Profile
    try {
      const profileResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: 'Profile!A1:B20'
      });
      const profileData = profileResponse.data.values || [];
      profileData.slice(1).forEach(row => {
        if (row[0] && row[1]) {
          const key = row[0].toLowerCase().replace(/ /g, '_');
          result.profile[key] = row[1];
        }
      });
    } catch (e) {
      console.warn('Could not load profile data');
    }

    // Load Attendance
    try {
      const attendanceResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: 'Attendance!A1:D100'
      });
      const attendanceData = attendanceResponse.data.values || [];
      attendanceData.slice(1).forEach(row => {
        if (row[0]) {
          result.attendance.push({
            subject: row[0],
            attended: row[1] || '',
            total: row[2] || '',
            percentage: row[3] || ''
          });
        }
      });
    } catch (e) {
      console.warn('Could not load attendance data');
    }

    // Load Marks
    try {
      const marksResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: 'Marks!A1:E100'
      });
      const marksData = marksResponse.data.values || [];
      marksData.slice(1).forEach(row => {
        if (row[0]) {
          result.marks.push({
            subject: row[0],
            marks: row[1] || '',
            grade: row[2] || '',
            exam_type: row[3] || '',
            total_marks: row[4] || ''
          });
        }
      });
    } catch (e) {
      console.warn('Could not load marks data');
    }

    // Load Timetable
    try {
      const timetableResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: 'Timetable!A1:E100'
      });
      const timetableData = timetableResponse.data.values || [];
      timetableData.slice(1).forEach(row => {
        if (row[0]) {
          result.timetable.push({
            day: row[0],
            time_slot: row[1] || '',
            subject: row[2] || '',
            teacher: row[3] || '',
            room: row[4] || ''
          });
        }
      });
    } catch (e) {
      console.warn('Could not load timetable data');
    }

    // Load Metadata to get last updated time
    try {
      const metadataResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: 'Metadata!A1:B10'
      });
      const metadataData = metadataResponse.data.values || [];
      metadataData.forEach(row => {
        if (row[0] === 'Last Updated') {
          result.lastUpdated = row[1];
        }
      });
    } catch (e) {
      console.warn('Could not load metadata');
    }

    return result;
  } catch (error) {
    console.error('Error loading from Google Sheets:', error.message);
    return null;
  }
}

/**
 * Check if Google Sheets service is available
 * @returns {boolean} - True if service is initialized
 */
async function isAvailable() {
  await initializeAuth();
  return !!(sheetsClient && driveClient);
}

module.exports = {
  initializeAuth,
  saveUserData,
  loadUserData,
  isAvailable,
  findOrCreateUserSheet,
  GOOGLE_DRIVE_FOLDER_ID
};
