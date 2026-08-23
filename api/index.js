// Vercel serverless function entry point.
// Reuses the FULL Express app from server/index.js so every route,
// middleware and feature behaves exactly like a self-hosted deployment.
// server/index.js detects VERCEL env var and skips port binding,
// Socket.IO and Redis initialization automatically.
const { app } = require('../server/index');

module.exports = app;
