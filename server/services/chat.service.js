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
class ChatService {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map();
    this.typingUsers = new Map();
  }

  initializeChatSockets(socket) {
    socket.on('join_chat', async (data) => {
      try {
        const { userId, groupId, userName } = data;
        socket.join(`group_${groupId}`);
        this.activeUsers.set(socket.id, { userId, groupId, userName });

        const onlineCount = await this.getOnlineCount(groupId);
        this.io.to(`group_${groupId}`).emit('user_joined', {
          userId,
          userName,
          onlineCount,
          timestamp: new Date()
        });

        const messages = await this.getRecentMessages(groupId);
        socket.emit('message_history', messages);
      } catch (error) {
        console.error('Error in join_chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { groupId, userId, message, attachments } = data;
        if (!message || message.trim() === '') {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }

        const user = await getRecord('users', String(userId));
        if (!user) {
          return socket.emit('error', { message: 'User not found' });
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
      } catch (error) {
        console.error('Error in send_message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing_start', (data) => {
      try {
        const { groupId, userId, userName } = data;
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
        const { groupId, userId } = data;
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
        const { messageId, userId } = data;
        const message = await getRecord('chat_messages', String(messageId));
        if (!message || String(message.user_id) !== String(userId)) {
          return socket.emit('error', { message: 'Cannot delete this message' });
        }

        await updateRecord('chat_messages', message.id, {
          is_deleted: true
        });

        this.io.to(`group_${message.group_id}`).emit('message_deleted', { messageId });
      } catch (error) {
        console.error('Error in delete_message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    socket.on('edit_message', async (data) => {
      try {
        const { messageId, userId, newMessage } = data;
        if (!newMessage || newMessage.trim() === '') {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }

        const message = await getRecord('chat_messages', String(messageId));
        if (!message || String(message.user_id) !== String(userId)) {
          return socket.emit('error', { message: 'Cannot edit this message' });
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
      } catch (error) {
        console.error('Error in edit_message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, userId, emoji } = data;
        const message = await getRecord('chat_messages', String(messageId));
        if (!message) {
          return;
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

  async getRecentMessages(groupId, limit = 50) {
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
