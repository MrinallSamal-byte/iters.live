const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
let serviceAccount;
let db, auth, storage, realtimeDb;
let isFirebaseAdminReady = false;
let isRealtimeDbReady = false;

function normalizePrivateKey(value) {
    if (!value || typeof value !== 'string') return value;
    return value.replace(/\\n/g, '\n');
}

function loadServiceAccountFromEnv() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (parsed.private_key) {
            parsed.private_key = normalizePrivateKey(parsed.private_key);
        }
        return parsed;
    }

    if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ) {
        return {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
            token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
    }

    return null;
}

try {
    // Try to load from file first
    try {
        serviceAccount = require('../serviceAccountKey.json');
    } catch (e) {
        serviceAccount = loadServiceAccountFromEnv();
    }

    if (serviceAccount && serviceAccount.private_key) {
        serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
    }

    if (serviceAccount && serviceAccount.private_key !== "-----BEGIN PRIVATE KEY-----\nREPLACE_WITH_YOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n") {
        const appConfig = {
            credential: admin.credential.cert(serviceAccount),
            storageBucket: "iterslive.firebasestorage.app"
        };

        if (process.env.FIREBASE_DATABASE_URL) {
            appConfig.databaseURL = process.env.FIREBASE_DATABASE_URL;
        }

        admin.initializeApp(appConfig);
        console.log('✓ Firebase Admin SDK initialized successfully');

        db = admin.firestore();
        auth = admin.auth();
        storage = admin.storage();
        isFirebaseAdminReady = true;

        if (process.env.FIREBASE_DATABASE_URL) {
            realtimeDb = admin.database();
            isRealtimeDbReady = true;
            console.log('✓ Firebase Realtime Database initialized successfully');
        } else {
            console.warn('⚠️ FIREBASE_DATABASE_URL not set. Realtime Database mirroring is disabled.');
        }
    } else {
        console.warn('⚠️ valid serviceAccountKey.json not found. Firebase Admin SDK not initialized.');
        console.warn('⚠️ Configure Firebase using server/serviceAccountKey.json or FIREBASE_* environment variables.');

        // Mock objects that throw errors
        const throwErr = () => { throw new Error('Firebase Admin SDK not initialized. Missing serviceAccountKey.json'); };
        db = { collection: throwErr, doc: throwErr, batch: throwErr };
        auth = { verifyIdToken: throwErr, createCustomToken: throwErr, createUser: throwErr };
        storage = { bucket: throwErr };
        realtimeDb = { ref: throwErr };
    }
} catch (error) {
    console.error('✗ Failed to initialize Firebase Admin SDK:', error);
    const throwErr = () => { throw new Error('Firebase Admin SDK initialization failed'); };
    db = { collection: throwErr, doc: throwErr, batch: throwErr };
    auth = { verifyIdToken: throwErr, createCustomToken: throwErr, createUser: throwErr };
    storage = { bucket: throwErr };
    realtimeDb = { ref: throwErr };
}

module.exports = {
    admin,
    db,
    auth,
    storage,
    realtimeDb,
    isFirebaseAdminReady,
    isRealtimeDbReady
};
