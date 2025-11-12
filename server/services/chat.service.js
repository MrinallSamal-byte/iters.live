const db = require('../database/db');

/**
 * Real-Time Chat Service
 * Handles study group chat functionality with Socket.IO
 * Part of ITER EduHub Enhancement Suite
 */
class ChatService {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // socket.id -> {userId, groupId, userName}
        this.typingUsers = new Map(); // groupId -> Set of userIds
    }

    /**
     * Initialize chat socket events
     */
    initializeChatSockets(socket) {
        // User joins a chat room
        socket.on('join_chat', async (data) => {
            try {
                const { userId, groupId, userName } = data;
                
                // Join the Socket.IO room
                socket.join(`group_${groupId}`);
                
                // Track active user
                this.activeUsers.set(socket.id, { userId, groupId, userName });
                
                // Get online count
                const onlineCount = await this.getOnlineCount(groupId);
                
                // Notify others
                this.io.to(`group_${groupId}`).emit('user_joined', {
                    userId,
                    userName,
                    onlineCount,
                    timestamp: new Date()
                });
                
                // Send recent messages to the joining user
                const messages = await this.getRecentMessages(groupId);
                socket.emit('message_history', messages);
                
                console.log(`User ${userName} (${userId}) joined group ${groupId}`);
            } catch (error) {
                console.error('Error in join_chat:', error);
                socket.emit('error', { message: 'Failed to join chat' });
            }
        });

        // Send message
        socket.on('send_message', async (data) => {
            try {
                const { groupId, userId, message, attachments } = data;
                
                if (!message || message.trim() === '') {
                    return socket.emit('error', { message: 'Message cannot be empty' });
                }
                
                // Get user info
                const users = await db.query(
                    'SELECT name, profile_picture AS profile_pic FROM users WHERE id = ?',
                    [userId]
                );
                
                if (users.length === 0) {
                    return socket.emit('error', { message: 'User not found' });
                }
                
                const userName = users[0].name;
                const profilePicture = users[0].profile_pic;
                
                // Save to database
                const [result] = await db.query(
                    'INSERT INTO chat_messages (group_id, user_id, message, attachments, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [groupId, userId, message, JSON.stringify(attachments || [])]
                );
                
                const messageData = {
                    id: result.insertId,
                    groupId,
                    userId,
                    userName,
                    profilePicture,
                    message,
                    attachments: attachments || [],
                    timestamp: new Date()
                };
                
                // Broadcast to group
                this.io.to(`group_${groupId}`).emit('new_message', messageData);
                
                // Stop typing indicator
                this.removeTypingUser(groupId, userId);
                
                // Send push notification to offline users
                this.notifyOfflineUsers(groupId, userId, message, userName);
                
                console.log(`Message sent by ${userName} in group ${groupId}`);
            } catch (error) {
                console.error('Error in send_message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Typing indicator start
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

        // Typing indicator stop
        socket.on('typing_stop', (data) => {
            try {
                const { groupId, userId } = data;
                this.removeTypingUser(groupId, userId);
                
                socket.to(`group_${groupId}`).emit('user_stopped_typing', { 
                    userId,
                    typingUsers: this.typingUsers.get(groupId) ? 
                        Array.from(this.typingUsers.get(groupId)) : []
                });
            } catch (error) {
                console.error('Error in typing_stop:', error);
            }
        });

        // Delete message
        socket.on('delete_message', async (data) => {
            try {
                const { messageId, userId } = data;
                
                // Verify ownership
                const [messages] = await db.query(
                    'SELECT group_id FROM chat_messages WHERE id = ? AND user_id = ?',
                    [messageId, userId]
                );
                
                if (messages.length === 0) {
                    return socket.emit('error', { message: 'Cannot delete this message' });
                }
                
                const groupId = messages[0].group_id;
                
                // Soft delete
                await db.query(
                    'UPDATE chat_messages SET is_deleted = TRUE WHERE id = ?',
                    [messageId]
                );
                
                // Notify group
                this.io.to(`group_${groupId}`).emit('message_deleted', { messageId });
                
            } catch (error) {
                console.error('Error in delete_message:', error);
                socket.emit('error', { message: 'Failed to delete message' });
            }
        });

        // Edit message
        socket.on('edit_message', async (data) => {
            try {
                const { messageId, userId, newMessage } = data;
                
                if (!newMessage || newMessage.trim() === '') {
                    return socket.emit('error', { message: 'Message cannot be empty' });
                }
                
                // Verify ownership
                const [messages] = await db.query(
                    'SELECT group_id FROM chat_messages WHERE id = ? AND user_id = ?',
                    [messageId, userId]
                );
                
                if (messages.length === 0) {
                    return socket.emit('error', { message: 'Cannot edit this message' });
                }
                
                const groupId = messages[0].group_id;
                
                // Update message
                await db.query(
                    'UPDATE chat_messages SET message = ?, is_edited = TRUE, updated_at = NOW() WHERE id = ?',
                    [newMessage, messageId]
                );
                
                // Notify group
                this.io.to(`group_${groupId}`).emit('message_edited', { 
                    messageId, 
                    newMessage,
                    timestamp: new Date()
                });
                
            } catch (error) {
                console.error('Error in edit_message:', error);
                socket.emit('error', { message: 'Failed to edit message' });
            }
        });

        // Message reaction
        socket.on('add_reaction', async (data) => {
            try {
                const { messageId, userId, emoji } = data;
                
                // Store reaction (you may need to create a reactions table)
                // For now, just broadcast
                const [messages] = await db.query(
                    'SELECT group_id FROM chat_messages WHERE id = ?',
                    [messageId]
                );
                
                if (messages.length > 0) {
                    this.io.to(`group_${messages[0].group_id}`).emit('reaction_added', {
                        messageId,
                        userId,
                        emoji
                    });
                }
            } catch (error) {
                console.error('Error in add_reaction:', error);
            }
        });

        // Leave chat
        socket.on('leave_chat', () => {
            this.handleUserLeave(socket);
        });

        // Disconnect
        socket.on('disconnect', () => {
            this.handleUserLeave(socket);
        });
    }

    handleUserLeave(socket) {
        const userData = this.activeUsers.get(socket.id);
        if (userData) {
            const { userId, groupId, userName } = userData;
            
            // Remove from typing users
            this.removeTypingUser(groupId, userId);
            
            // Leave socket room
            socket.leave(`group_${groupId}`);
            
            // Get online count
            this.getOnlineCount(groupId).then(onlineCount => {
                // Notify others
                this.io.to(`group_${groupId}`).emit('user_left', {
                    userId,
                    userName,
                    onlineCount,
                    timestamp: new Date()
                });
            });
            
            // Remove from active users
            this.activeUsers.delete(socket.id);
            
            console.log(`User ${userName} (${userId}) left group ${groupId}`);
        }
    }

    removeTypingUser(groupId, userId) {
        if (this.typingUsers.has(groupId)) {
            this.typingUsers.get(groupId).delete(userId);
            if (this.typingUsers.get(groupId).size === 0) {
                this.typingUsers.delete(groupId);
            }
        }
    }

    async getOnlineCount(groupId) {
        let count = 0;
        for (const userData of this.activeUsers.values()) {
            if (userData.groupId === groupId) {
                count++;
            }
        }
        return count;
    }

    async getRecentMessages(groupId, limit = 50) {
        try {
            const messages = await db.query(
                `SELECT cm.*, u.name as userName, u.profile_picture AS profile_pic 
                 FROM chat_messages cm 
                 JOIN users u ON cm.user_id = u.id 
                 WHERE cm.group_id = ? AND cm.is_deleted = FALSE
                 ORDER BY cm.created_at DESC 
                 LIMIT ?`,
                [groupId, limit]
            );
            
            // Reverse to get oldest first
            return messages.reverse().map(msg => ({
                id: msg.id,
                groupId: msg.group_id,
                userId: msg.user_id,
                userName: msg.userName,
                profilePicture: msg.profile_pic,
                message: msg.message,
                attachments: JSON.parse(msg.attachments || '[]'),
                isEdited: msg.is_edited,
                timestamp: msg.created_at
            }));
        } catch (error) {
            console.error('Error fetching recent messages:', error);
            return [];
        }
    }

    async notifyOfflineUsers(groupId, senderId, message, senderName) {
        try {
            const [members] = await db.query(
                'SELECT user_id FROM study_group_members WHERE group_id = ? AND user_id != ?',
                [groupId, senderId]
            );
            
            // In a real implementation, you would:
            // 1. Check which users are not in activeUsers
            // 2. Send push notifications or emails
            // 3. Create in-app notifications
            
            // For now, we'll just log it
            console.log(`Notification sent to ${members.length} offline users`);
        } catch (error) {
            console.error('Error notifying offline users:', error);
        }
    }
}

module.exports = ChatService;
