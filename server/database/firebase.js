const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin SDK
let serviceAccount;
let db, auth, storage;

try {
    // Try to load from file first
    try {
        serviceAccount = require('../serviceAccountKey.json');
    } catch (e) {
        // If file not found, check environment variable
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
    }

    if (serviceAccount && serviceAccount.private_key !== "-----BEGIN PRIVATE KEY-----\nREPLACE_WITH_YOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n") {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: "iterslive.firebasestorage.app"
        });
        console.log('✓ Firebase Admin SDK initialized successfully');

        db = admin.firestore();
        auth = admin.auth();
        storage = admin.storage();
    } else {
        console.warn('⚠️ valid serviceAccountKey.json not found. Firebase Admin SDK not initialized.');
        console.warn('⚠️ Please replace server/serviceAccountKey.json with your actual key.');

        // Mock objects that throw errors
        const throwErr = () => { throw new Error('Firebase Admin SDK not initialized. Missing serviceAccountKey.json'); };
        db = { collection: throwErr, doc: throwErr, batch: throwErr };
        auth = { verifyIdToken: throwErr, createCustomToken: throwErr, createUser: throwErr };
        storage = { bucket: throwErr };
    }
} catch (error) {
    console.error('✗ Failed to initialize Firebase Admin SDK:', error);
    const throwErr = () => { throw new Error('Firebase Admin SDK initialization failed'); };
    db = { collection: throwErr, doc: throwErr, batch: throwErr };
    auth = { verifyIdToken: throwErr, createCustomToken: throwErr, createUser: throwErr };
    storage = { bucket: throwErr };
}

module.exports = {
    admin,
    db,
    auth,
    storage
};
