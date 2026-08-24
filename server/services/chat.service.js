const {
  createRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('./firebase-data.service');

/**
 * Real-Time Chat Service
 * Handles study group chat functionality with Socket.IO
 */

// Safe emitter used when no Socket.IO server exists (REST-only usage,
// e.g. Vercel serverless). Broadcasts become no-ops instead of crashes.
function createNoopIo() {
  const noop = () => {};
  const chainable = () => ({ emit: noop, to: chainable, in: chainable });
  return { emit: noop, to: chainable, in: chainable };
}

class ChatService {
  constructor(io) {
    this.io = io || createNoopIo();
    this.activeUsers = new Map();
    this.typingUsers = new Map();
  }

  initializeChatSockets(socket) {
    socket.on('join_chat', async (data) => {
      try {
        const { groupId } = data;
        // Identity fix: trust handshake identity only; ignore client-sent userId/userName
        const userId = socket.userId;
        const userName = socket.userName || 'User';

        // Membership gate runs BEFORE joining the room so non-members cannot eavesdrop
        const messages = await this.getRecentMessages(groupId, 50, userId);

        socket.join(`group_${groupId}`);
        this.activeUsers.set(socket.id, { userId, groupId, userName });

        const onlineCount = await this.getOnlineCount(groupId);
        this.io.to(`group_${groupId}`).emit('user_joined', {
          userId,
          userName,
          onlineCount,
          timestamp: new Date()
        });

        socket.emit('message_history', messages);
      } catch (error) {
        console.error('Error in join_chat:', error);
        socket.emit('error', { message: error.message === 'Not a member' ? 'Not a member' : 'Failed to join chat' });
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { groupId, message, attachments } = data;
        if (!message || message.trim() === '') {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }

        // Identity fix: ignore client-sent userId
        await this.sendMessage({ groupId, userId: socket.userId, message, attachments });
      } catch (error) {
        console.error('Error in send_message:', error);
        socket.emit('error', { message: error.message === 'Not a member' ? 'Not a member' : 'Failed to send message' });
      }
    });

    socket.on('typing_start', (data) => {
      try {
        const { groupId } = data;
        // Identity fix: ignore client-sent userId/userName
        const userId = socket.userId;
        const userName = socket.userName || 'User';
        if (!this.typingUsers.has(groupId)) {
          this.typingUsers.set(groupId, new Set());
        }

        this.typingUsers.get(groupId).add(userId);
        socket.to(`group_${groupId}`).emit('user_typing', {
          userId,
          userName,
          typingUsers: Array.from(this.typingUsers.get(groupId))
        });
      } catch (error) {
        console.error('Error in typing_start:', error);
      }
    });

    socket.on('typing_stop', (data) => {
      try {
        const { groupId } = data;
        // Identity fix: ignore client-sent userId
        const userId = socket.userId;
        this.removeTypingUser(groupId, userId);
        socket.to(`group_${groupId}`).emit('user_stopped_typing', {
          userId,
          typingUsers: this.typingUsers.get(groupId)
            ? Array.from(this.typingUsers.get(groupId))
            : []
        });
      } catch (error) {
        console.error('Error in typing_stop:', error);
      }
    });

    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;
        // Identity fix: ignore client-sent userId
        await this.deleteMessage({ messageId, userId: socket.userId });
      } catch (error) {
        console.error('Error in delete_message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    socket.on('edit_message', async (data) => {
      try {
        const { messageId, newMessage } = data;
        if (!newMessage || newMessage.trim() === '') {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }
        // Identity fix: ignore client-sent userId
        await this.editMessage({ messageId, userId: socket.userId, newMessage });
      } catch (error) {
        console.error('Error in edit_message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        // Identity fix: ignore client-sent userId
        await this.addReaction({ messageId, userId: socket.userId, emoji });
      } catch (error) {
        console.error('Error in add_reaction:', error);
      }
    });

    socket.on('leave_chat', () => {
      this.handleUserLeave(socket);
    });

    socket.on('disconnect', () => {
      this.handleUserLeave(socket);
    });
  }

  /**
   * Throws 'Not a member' unless a study_group_members record exists
   * for {group_id, user_id}.
   */
  async assertGroupMember(groupId, userId) {
    const members = await listRecords('study_group_members', {
      filters: [
        { field: 'group_id', value: String(groupId) },
        { field: 'user_id', value: String(userId) }
      ]
    });

    if (!members || members.length === 0) {
      throw new Error('Not a member');
    }
  }

  /**
   * Persist and broadcast a chat message. Shared by the Socket.IO handler
   * and the REST fallback endpoints (used where WebSockets are unavailable,
   * e.g. Vercel serverless).
   */
  async sendMessage({ groupId, userId, message, attachments }) {
    await this.assertGroupMember(groupId, userId);

    const user = await getRecord('users', String(userId));
    if (!user) {
      throw new Error('User not found');
    }

    const record = await createRecord('chat_messages', {
      group_id: String(groupId),
      user_id: String(userId),
      message,
      attachments: Array.isArray(attachments) ? attachments : [],
      is_deleted: false,
      is_edited: false
    });

    const messageData = this.toMessagePayload(record, user);
    this.io.to(`group_${groupId}`).emit('new_message', messageData);
    this.removeTypingUser(groupId, userId);
    await this.notifyOfflineUsers(groupId, userId, message, user.name || user.full_name || 'User');
    return messageData;
  }

  async deleteMessage({ messageId, userId }) {
    const message = await getRecord('chat_messages', String(messageId));
    if (!message || String(message.user_id) !== String(userId)) {
      throw new Error('Cannot delete this message');
    }

    await updateRecord('chat_messages', message.id, {
      is_deleted: true
    });

    this.io.to(`group_${message.group_id}`).emit('message_deleted', { messageId });
    return true;
  }

  async editMessage({ messageId, userId, newMessage }) {
    const message = await getRecord('chat_messages', String(messageId));
    if (!message || String(message.user_id) !== String(userId)) {
      throw new Error('Cannot edit this message');
    }

    await updateRecord('chat_messages', message.id, {
      message: newMessage,
      is_edited: true
    });

    this.io.to(`group_${message.group_id}`).emit('message_edited', {
      messageId,
      newMessage,
      timestamp: new Date()
    });
    return true;
  }

  async addReaction({ messageId, userId, emoji }) {
    const message = await getRecord('chat_messages', String(messageId));
    if (!message) {
      throw new Error('Message not found');
    }

    const reactions = Array.isArray(message.reactions) ? [...message.reactions] : [];
    reactions.push({
      user_id: String(userId),
      emoji,
      created_at: new Date().toISOString()
    });

    await updateRecord('chat_messages', message.id, { reactions });
    this.io.to(`group_${message.group_id}`).emit('reaction_added', {
      messageId,
      userId,
      emoji
    });
    return true;
  }

  handleUserLeave(socket) {
    const userData = this.activeUsers.get(socket.id);
    if (!userData) {
      return;
    }

    const { userId, groupId, userName } = userData;
    this.removeTypingUser(groupId, userId);
    socket.leave(`group_${groupId}`);

    this.getOnlineCount(groupId).then((onlineCount) => {
      this.io.to(`group_${groupId}`).emit('user_left', {
        userId,
        userName,
        onlineCount,
        timestamp: new Date()
      });
    });

    this.activeUsers.delete(socket.id);
  }

  removeTypingUser(groupId, userId) {
    if (!this.typingUsers.has(groupId)) {
      return;
    }

    this.typingUsers.get(groupId).delete(userId);
    if (this.typingUsers.get(groupId).size === 0) {
      this.typingUsers.delete(groupId);
    }
  }

  async getOnlineCount(groupId) {
    let count = 0;
    for (const userData of this.activeUsers.values()) {
      if (String(userData.groupId) === String(groupId)) {
        count += 1;
      }
    }
    return count;
  }

  async getRecentMessages(groupId, limit = 50, userId) {
    // Membership gate; throws 'Not a member' for non-members
    await this.assertGroupMember(groupId, userId);

    try {
      const messages = await listRecords('chat_messages', {
        filters: [
          { field: 'group_id', value: String(groupId) },
          { field: 'is_deleted', value: false }
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' }],
        limit
      });

      const users = await listRecords('users');
      const userById = new Map(users.map((user) => [String(user.id), user]));

      return messages
        .slice()
        .reverse()
        .map((message) => this.toMessagePayload(message, userById.get(String(message.user_id))));
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      return [];
    }
  }

  toMessagePayload(message, user) {
    return {
      id: message.id,
      groupId: message.group_id,
      userId: message.user_id,
      userName: user?.name || user?.full_name || user?.username || 'User',
      profilePicture: user?.profile_picture || user?.profile_pic || null,
      message: message.message,
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      isEdited: Boolean(message.is_edited),
      timestamp: message.created_at || new Date().toISOString()
    };
  }

  async notifyOfflineUsers(groupId, senderId, message, senderName) {
    try {
      const members = await listRecords('study_group_members', {
        filters: [{ field: 'group_id', value: String(groupId) }]
      });

      const offlineUsers = members.filter((member) => {
        if (String(member.user_id) === String(senderId)) {
          return false;
        }

        return !Array.from(this.activeUsers.values()).some((active) =>
          String(active.groupId) === String(groupId) && String(active.userId) === String(member.user_id));
      });

      if (offlineUsers.length > 0) {
        console.log(`Notification queued for ${offlineUsers.length} offline users from ${senderName}: ${message.slice(0, 60)}`);
      }
    } catch (error) {
      console.error('Error notifying offline users:', error);
    }
  }
}

module.exports = ChatService;
