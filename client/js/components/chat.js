/**
 * Real-Time Chat Component
 * Study group chat with typing indicators and file attachments
 * Part of ITER EduHub Enhancement Suite
 */
class ChatComponent {
    constructor(groupId, userId, userName) {
        this.groupId = groupId;
        this.userId = userId;
        this.userName = userName;
        this.socket = null;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messages = [];
        this.init();
    }

    init() {
        this.createChatUI();
        this.connectSocket();
        this.setupEventHandlers();
    }

    connectSocket() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.showError('Authentication required');
            return;
        }

        this.socket = io(window.API_BASE_URL || 'http://localhost:5000', {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000
        });

        this.setupSocketListeners();
    }

    createChatUI() {
        const chatHTML = `
            <div class="chat-container glass-card">
                <div class="chat-header">
                    <div class="chat-header-left">
                        <h3>Study Group Chat</h3>
                        <div class="online-status">
                            <span class="status-dot online"></span>
                            <span id="onlineCount">0 online</span>
                        </div>
                    </div>
                    <div class="chat-header-right">
                        <button class="chat-menu-btn" id="chatMenuBtn" title="Options">⋮</button>
                    </div>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-loading">Loading messages...</div>
                </div>
                
                <div class="typing-indicator" id="typingIndicator" style="display: none;">
                    <span class="typing-dots">
                        <span></span><span></span><span></span>
                    </span>
                    <span id="typingText"></span>
                </div>
                
                <div class="chat-input-container">
                    <button class="attach-btn" id="attachBtn" title="Attach file">
                        📎
                    </button>
                    <input 
                        type="text" 
                        id="chatInput" 
                        placeholder="Type a message..." 
                        class="chat-input"
                        autocomplete="off"
                    />
                    <button class="emoji-btn" id="emojiBtn" title="Emoji">
                        😊
                    </button>
                    <button class="send-btn" id="sendBtn" disabled>
                        <span>Send</span>
                    </button>
                </div>
            </div>
        `;
        
        const container = document.getElementById('chatComponentContainer');
        if (container) {
            container.innerHTML = chatHTML;
        }
    }

    setupSocketListeners() {
        // Connection successful
        this.socket.on('connect', () => {
            console.log('Chat connected');
            this.reconnectAttempts = 0;
            this.joinChat();
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('Chat connection error:', error);
            this.showError('Connection failed. Retrying...');
        });

        // Reconnection attempt
        this.socket.on('reconnect_attempt', () => {
            this.reconnectAttempts++;
            console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        });

        // Receive message history
        this.socket.on('message_history', (messages) => {
            this.messages = messages;
            this.renderMessages(messages);
        });

        // Receive new message
        this.socket.on('new_message', (message) => {
            this.messages.push(message);
            this.addMessage(message);
            this.scrollToBottom();
            
            // Play notification sound if not own message
            if (message.userId !== this.userId) {
                this.playNotificationSound();
            }
        });

        // User typing
        this.socket.on('user_typing', (data) => {
            if (data.userId !== this.userId) {
                this.showTypingIndicator(data.userName);
            }
        });

        this.socket.on('user_stopped_typing', () => {
            this.hideTypingIndicator();
        });

        // User joined/left
        this.socket.on('user_joined', (data) => {
            if (data.userId !== this.userId) {
                this.showSystemMessage(`${data.userName} joined the chat`);
            }
            this.updateOnlineCount(data.onlineCount);
        });

        this.socket.on('user_left', (data) => {
            this.showSystemMessage(`${data.userName} left the chat`);
            this.updateOnlineCount(data.onlineCount);
        });

        // Message deleted
        this.socket.on('message_deleted', (data) => {
            this.removeMessage(data.messageId);
        });

        // Message edited
        this.socket.on('message_edited', (data) => {
            this.updateMessage(data.messageId, data.newMessage);
        });

        // Reaction added
        this.socket.on('reaction_added', (data) => {
            this.addReaction(data.messageId, data.emoji);
        });

        // Error
        this.socket.on('error', (error) => {
            this.showError(error.message);
        });
    }

    setupEventHandlers() {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const attachBtn = document.getElementById('attachBtn');
        const emojiBtn = document.getElementById('emojiBtn');

        if (!input || !sendBtn) return;

        // Enable/disable send button
        input.addEventListener('input', (e) => {
            sendBtn.disabled = e.target.value.trim() === '';
            this.handleTyping();
        });

        // Send message on button click
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // File attachment
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.openFileDialog());
        }

        // Emoji picker
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.showEmojiPicker());
        }
    }

    joinChat() {
        this.socket.emit('join_chat', {
            userId: this.userId,
            groupId: this.groupId,
            userName: this.userName
        });
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || !this.socket) return;
        
        this.socket.emit('send_message', {
            groupId: this.groupId,
            userId: this.userId,
            message,
            attachments: []
        });
        
        input.value = '';
        document.getElementById('sendBtn').disabled = true;
        
        this.socket.emit('typing_stop', { 
            groupId: this.groupId, 
            userId: this.userId 
        });
    }

    handleTyping() {
        if (!this.socket) return;

        this.socket.emit('typing_start', {
            groupId: this.groupId,
            userId: this.userId,
            userName: this.userName
        });
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing_stop', { 
                groupId: this.groupId, 
                userId: this.userId 
            });
        }, 1500);
    }

    addMessage(message) {
        const container = document.getElementById('chatMessages');
        const loading = container.querySelector('.chat-loading');
        if (loading) loading.remove();

        const isOwnMessage = message.userId === this.userId;
        const time = this.formatTime(message.timestamp);
        
        const messageHTML = `
            <div class="chat-message ${isOwnMessage ? 'own-message' : ''}" data-message-id="${message.id}">
                ${!isOwnMessage ? `
                    <div class="message-avatar">
                        <img src="${message.profilePicture || '/assets/default-avatar.png'}" 
                             alt="${this.escapeHTML(message.userName)}">
                    </div>
                ` : ''}
                <div class="message-content">
                    ${!isOwnMessage ? `
                        <div class="message-header">
                            <span class="message-author">${this.escapeHTML(message.userName)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                    ` : ''}
                    <div class="message-text">${this.escapeHTML(message.message)}</div>
                    ${message.isEdited ? '<span class="message-edited">(edited)</span>' : ''}
                    ${message.attachments && message.attachments.length > 0 ? 
                        this.renderAttachments(message.attachments) : ''}
                    <div class="message-actions">
                        ${isOwnMessage ? `
                            <button class="message-action-btn" onclick="chatComponent.editMessage(${message.id})">Edit</button>
                            <button class="message-action-btn" onclick="chatComponent.deleteMessage(${message.id})">Delete</button>
                        ` : ''}
                        <button class="message-action-btn" onclick="chatComponent.reactToMessage(${message.id})">React</button>
                    </div>
                    ${!isOwnMessage ? '' : `<div class="message-time-own">${time}</div>`}
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', messageHTML);
    }

    renderMessages(messages) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation!</div>';
            return;
        }
        
        messages.forEach(msg => this.addMessage(msg));
        this.scrollToBottom();
    }

    removeMessage(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => messageEl.remove(), 300);
        }
    }

    updateMessage(messageId, newMessage) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"] .message-text`);
        if (messageEl) {
            messageEl.textContent = newMessage;
            const editedLabel = '<span class="message-edited">(edited)</span>';
            messageEl.insertAdjacentHTML('afterend', editedLabel);
        }
    }

    addReaction(messageId, emoji) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            let reactions = messageEl.querySelector('.message-reactions');
            if (!reactions) {
                reactions = document.createElement('div');
                reactions.className = 'message-reactions';
                messageEl.querySelector('.message-content').appendChild(reactions);
            }
            reactions.insertAdjacentHTML('beforeend', `<span class="reaction">${emoji}</span>`);
        }
    }

    deleteMessage(messageId) {
        if (confirm('Delete this message?')) {
            this.socket.emit('delete_message', {
                messageId,
                userId: this.userId
            });
        }
    }

    editMessage(messageId) {
        const newMessage = prompt('Edit message:');
        if (newMessage && newMessage.trim()) {
            this.socket.emit('edit_message', {
                messageId,
                userId: this.userId,
                newMessage: newMessage.trim()
            });
        }
    }

    reactToMessage(messageId) {
        const emoji = prompt('Enter emoji:', '👍');
        if (emoji) {
            this.socket.emit('add_reaction', {
                messageId,
                userId: this.userId,
                emoji
            });
        }
    }

    showTypingIndicator(userName) {
        const indicator = document.getElementById('typingIndicator');
        const text = document.getElementById('typingText');
        if (indicator && text) {
            text.textContent = `${userName} is typing...`;
            indicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    showSystemMessage(text) {
        const container = document.getElementById('chatMessages');
        const messageHTML = `
            <div class="system-message">
                <span>${this.escapeHTML(text)}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    updateOnlineCount(count) {
        const onlineCount = document.getElementById('onlineCount');
        if (onlineCount) {
            onlineCount.textContent = `${count} online`;
        }
    }

    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    playNotificationSound() {
        // Optional: Play a subtle notification sound
        const audio = new Audio('/assets/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    }

    openFileDialog() {
        // Implement file upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf,.doc,.docx';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.uploadFile(file);
            }
        };
        input.click();
    }

    uploadFile(file) {
        // Implement file upload to server
        console.log('File upload:', file.name);
        this.showError('File upload coming soon!');
    }

    showEmojiPicker() {
        // Simple emoji picker
        const emojis = ['😊', '👍', '❤️', '😂', '🎉', '🔥', '✨', '💯'];
        const input = document.getElementById('chatInput');
        const emoji = prompt('Choose emoji:', emojis.join(' '));
        if (emoji && input) {
            input.value += emoji;
            input.focus();
        }
    }

    renderAttachments(attachments) {
        return attachments.map(att => `
            <div class="message-attachment">
                <a href="${att.url}" target="_blank">${att.name}</a>
            </div>
        `).join('');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.socket) {
            this.socket.emit('leave_chat');
            this.socket.disconnect();
        }
        clearTimeout(this.typingTimeout);
    }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
    try {
        const container = document.getElementById('chatComponentContainer');
        if (container && container.dataset.groupId && container.dataset.userId) {
            window.chatComponent = new ChatComponent(
                parseInt(container.dataset.groupId),
                parseInt(container.dataset.userId),
                container.dataset.userName || 'User'
            );
        }
    } catch (error) {
        console.error('Chat component initialization failed:', error);
    }
});
