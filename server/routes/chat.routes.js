/**
 * Chat REST Routes
 * REST fallback for the study-group chat so the feature keeps working in
 * environments where Socket.IO WebSockets are unavailable (e.g. Vercel
 * serverless functions). The client polls these endpoints when it cannot
 * connect via WebSocket.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const ChatService = require('../services/chat.service');

// Standalone service instance for REST usage; on a normal server the
// socket-bound instance (server/socket/socket.js) handles live events and
// this one only touches the database + emits through the shared io (no-op
// when sockets are unavailable).
const chatService = new ChatService(null);

/**
 * GET /api/chat/groups/:groupId/messages
 * Message history for a study group (same payload as socket 'message_history')
 */
router.get('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const messages = await chatService.getRecentMessages(req.params.groupId, limit, req.user.id);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    if (error.message === 'Not a member') {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chat/groups/:groupId/messages
 * Send a message to a study group (same effect as socket 'send_message')
 */
router.post('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message, attachments } = req.body || {};

    if (!message || String(message).trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const messageData = await chatService.sendMessage({
      groupId,
      userId: req.user.id,
      message: String(message),
      attachments
    });

    res.status(201).json({ success: true, message: messageData });
  } catch (error) {
    console.error('Error sending chat message:', error);
    if (error.message === 'Not a member') {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }
    const status = error.message === 'User not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to send message' });
  }
});

/**
 * PUT /api/chat/messages/:messageId
 * Edit own message (same effect as socket 'edit_message')
 */
router.put('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { newMessage } = req.body || {};
    if (!newMessage || String(newMessage).trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    await chatService.editMessage({
      messageId: req.params.messageId,
      userId: req.user.id,
      newMessage: String(newMessage)
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error editing chat message:', error);
    const status = error.message === 'Cannot edit this message' ? 403 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to edit message' });
  }
});

/**
 * DELETE /api/chat/messages/:messageId
 * Delete own message (same effect as socket 'delete_message')
 */
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    await chatService.deleteMessage({
      messageId: req.params.messageId,
      userId: req.user.id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    const status = error.message === 'Cannot delete this message' ? 403 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to delete message' });
  }
});

module.exports = router;
