/**
 * AI Chatbot Widget
 * Lightweight AI-powered assistant for FAQs and navigation help
 * Part of ITER EduHub Enhancement Suite
 */

class Chatbot {
    constructor() {
        this.isOpen = false;
        this.isLoading = false;
        this.messages = [];
        this.container = null;
        this.toggleBtn = null;
        this.messagesContainer = null;
        this.input = null;
        
        // FAQ database for quick responses (no API needed)
        this.faqDatabase = {
            // Attendance related
            'attendance': {
                keywords: ['attendance', 'present', 'absent', 'percentage', 'classes'],
                answer: 'You can view your attendance in the <a href="student-attendance.html" class="nav-suggestion">📊 Attendance Section</a>. It shows subject-wise attendance, heatmap calendar, and alerts for low attendance. Minimum 75% attendance is required for exam eligibility.'
            },
            'low attendance': {
                keywords: ['low attendance', 'shortage', 'attendance issue', 'below 75'],
                answer: 'If your attendance is below 75%, you should: \n1. Submit an attendance regularization form\n2. Contact your department HOD\n3. Provide medical certificates if applicable\n\nCheck your status in <a href="student-attendance.html" class="nav-suggestion">📊 Attendance Section</a>'
            },
            // Marks related
            'marks': {
                keywords: ['marks', 'grades', 'result', 'cgpa', 'sgpa', 'performance'],
                answer: 'View your academic performance in the <a href="student-marks.html" class="nav-suggestion">📈 Marks Section</a>. You can see:\n• Subject-wise marks\n• SGPA/CGPA calculation\n• Performance trends\n• Grade distribution'
            },
            // Timetable
            'timetable': {
                keywords: ['timetable', 'schedule', 'classes', 'timings', 'lecture'],
                answer: 'Access your class schedule in <a href="student-timetable.html" class="nav-suggestion">📅 Timetable</a>. It shows:\n• Daily class schedule\n• Current class highlight\n• Subject & faculty details\n• Room numbers'
            },
            // Assignments
            'assignment': {
                keywords: ['assignment', 'homework', 'submission', 'deadline', 'project'],
                answer: 'Check pending assignments in your dashboard. For submission:\n1. Upload before deadline\n2. Accepted formats: PDF, DOC, ZIP\n3. Max file size: 10MB\n\nLate submissions may attract penalties.'
            },
            // Exam related
            'exam': {
                keywords: ['exam', 'examination', 'admit card', 'hall ticket', 'test'],
                answer: 'For exam information:\n• Download admit card from <a href="student-admit-card.html" class="nav-suggestion">🎫 Admit Card</a>\n• Check exam schedule on notice board\n• Carry college ID & admit card\n• Report 30 mins before exam'
            },
            'admit card': {
                keywords: ['admit card', 'hall ticket', 'exam card'],
                answer: 'Download your admit card from <a href="student-admit-card.html" class="nav-suggestion">🎫 Admit Card Section</a>. It includes:\n• Your photo & details\n• Exam schedule\n• Examination center\n• Important instructions'
            },
            // Notes & Study
            'notes': {
                keywords: ['notes', 'study material', 'pdf', 'lecture notes', 'materials'],
                answer: 'Access study materials in <a href="student-notes.html" class="nav-suggestion">📚 Study Notes</a>. Find:\n• Subject-wise notes\n• Lecture presentations\n• Reference materials\n• Video lectures links'
            },
            'pyq': {
                keywords: ['pyq', 'previous year', 'question papers', 'old papers', 'question bank'],
                answer: 'Previous Year Questions are available in <a href="student-pyq.html" class="nav-suggestion">📝 PYQ Section</a>. You can:\n• Filter by subject & year\n• Download question papers\n• Practice with solutions'
            },
            // Events & Activities
            'events': {
                keywords: ['events', 'fest', 'competition', 'activities', 'clubs'],
                answer: 'Check upcoming events in <a href="student-events.html" class="nav-suggestion">🎉 Events Section</a>. Register for:\n• Technical fests\n• Cultural events\n• Workshops\n• Competitions'
            },
            'clubs': {
                keywords: ['clubs', 'society', 'join', 'member'],
                answer: 'Explore student clubs in <a href="student-clubs.html" class="nav-suggestion">🎭 Clubs Section</a>. Join:\n• Technical clubs\n• Cultural societies\n• Sports teams\n• Professional chapters'
            },
            // Hostel
            'hostel': {
                keywords: ['hostel', 'mess', 'room', 'accommodation', 'food'],
                answer: 'Hostel services available at <a href="student-hostel-menu.html" class="nav-suggestion">🏨 Hostel Menu</a>:\n• Weekly mess menu\n• Room complaint form\n• Hostel rules\n• Leave application'
            },
            'mess menu': {
                keywords: ['mess', 'menu', 'food', 'canteen', 'lunch', 'dinner'],
                answer: 'Check the weekly mess menu at <a href="student-hostel-menu.html" class="nav-suggestion">🍽️ Mess Menu</a>. Includes breakfast, lunch, snacks, and dinner for each day.'
            },
            // Fee related
            'fee': {
                keywords: ['fee', 'fees', 'payment', 'tuition', 'scholarship'],
                answer: 'For fee related queries:\n• Login to parent portal for fee details\n• Payment via online banking/UPI\n• Apply for scholarships through admin office\n• Contact accounts section for receipt'
            },
            // Technical Support
            'password': {
                keywords: ['password', 'forgot password', 'reset', 'login issue', 'cant login'],
                answer: 'For login issues:\n1. Click "Forgot Password" on login page\n2. Enter registered email\n3. Check inbox for reset link\n4. If issue persists, contact IT helpdesk'
            },
            'help': {
                keywords: ['help', 'support', 'contact', 'issue', 'problem'],
                answer: 'Need help? Here are your options:\n• 📧 Email: support@iter.ac.in\n• 📞 Helpdesk: +91-674-2350171\n• 🏢 Visit: Admin Office (Block A)\n• 💬 Use this chatbot for quick answers!'
            },
            // Navigation
            'dashboard': {
                keywords: ['dashboard', 'home', 'main page', 'overview'],
                answer: 'Your Student Dashboard shows:\n• Attendance summary\n• Upcoming deadlines\n• Recent announcements\n• Quick access to all features\n\nGo to <a href="student.html" class="nav-suggestion">🏠 Dashboard</a>'
            },
            'forum': {
                keywords: ['forum', 'discussion', 'ask question', 'doubt', 'query'],
                answer: 'Visit the <a href="student-forum.html" class="nav-suggestion">💬 Student Forum</a> to:\n• Ask academic questions\n• Get answers from peers & faculty\n• Join study discussions\n• Share resources'
            },
            // General
            'college': {
                keywords: ['college', 'iter', 'soa', 'university', 'about'],
                answer: 'ITER (Institute of Technical Education & Research) is part of SOA University, Bhubaneswar.\n• NAAC A++ Accredited\n• NBA Approved Programs\n• 95%+ Placement Rate\n\nLearn more at <a href="/" class="nav-suggestion">🏛️ Home Page</a>'
            },
            'placement': {
                keywords: ['placement', 'job', 'career', 'recruitment', 'companies'],
                answer: 'ITER has excellent placements:\n• 95%+ placement rate\n• Top recruiters: Google, Microsoft, Amazon, TCS\n• Highest package: 30+ LPA\n• Average: 8+ LPA\n\nContact Training & Placement Cell for more info.'
            }
        };

        // Quick action suggestions
        this.quickActions = [
            { text: '📊 Attendance', query: 'How to check attendance?' },
            { text: '📈 Marks', query: 'View my marks' },
            { text: '📅 Timetable', query: 'Show timetable' },
            { text: '📝 PYQ', query: 'Previous year questions' }
        ];

        this.init();
    }

    init() {
        this.createChatbotUI();
        this.attachEventListeners();
        this.addWelcomeMessage();
    }

    createChatbotUI() {
        // Create toggle button
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'chatbot-toggle';
        this.toggleBtn.innerHTML = '<span class="chatbot-toggle-icon">🤖</span>';
        this.toggleBtn.title = 'Chat with ITER Assistant';
        document.body.appendChild(this.toggleBtn);

        // Create chatbot container
        this.container = document.createElement('div');
        this.container.className = 'chatbot-container';
        this.container.innerHTML = `
            <div class="chatbot-header">
                <div class="chatbot-header-info">
                    <div class="chatbot-avatar">🤖</div>
                    <div>
                        <h4 class="chatbot-title">ITER Assistant</h4>
                        <div class="chatbot-status">
                            <span class="chatbot-status-dot"></span>
                            <span>Online - Ask me anything!</span>
                        </div>
                    </div>
                </div>
                <button class="chatbot-close" title="Close chat">✕</button>
            </div>
            <div class="chatbot-messages" id="chatbotMessages"></div>
            <div class="chatbot-quick-actions" id="chatbotQuickActions"></div>
            <div class="chatbot-input-area">
                <input type="text" class="chatbot-input" id="chatbotInput" 
                    placeholder="Ask about attendance, marks, events..." 
                    autocomplete="off">
                <button class="chatbot-send" id="chatbotSend" title="Send message">➤</button>
            </div>
        `;
        document.body.appendChild(this.container);

        // Store references
        this.messagesContainer = document.getElementById('chatbotMessages');
        this.input = document.getElementById('chatbotInput');
        this.quickActionsContainer = document.getElementById('chatbotQuickActions');

        // Populate quick actions
        this.renderQuickActions();
    }

    renderQuickActions() {
        this.quickActionsContainer.innerHTML = this.quickActions.map(action => 
            `<button class="quick-action-btn" data-query="${action.query}">${action.text}</button>`
        ).join('');
    }

    attachEventListeners() {
        // Toggle button
        this.toggleBtn.addEventListener('click', () => this.toggle());

        // Close button
        this.container.querySelector('.chatbot-close').addEventListener('click', () => this.close());

        // Send button
        document.getElementById('chatbotSend').addEventListener('click', () => this.sendMessage());

        // Enter key to send
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Quick actions
        this.quickActionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const query = e.target.dataset.query;
                this.input.value = query;
                this.sendMessage();
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.container.contains(e.target) && 
                !this.toggleBtn.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('active', this.isOpen);
        this.toggleBtn.classList.toggle('active', this.isOpen);
        
        if (this.isOpen) {
            this.input.focus();
        }
    }

    open() {
        this.isOpen = true;
        this.container.classList.add('active');
        this.toggleBtn.classList.add('active');
        this.input.focus();
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('active');
        this.toggleBtn.classList.remove('active');
    }

    addWelcomeMessage() {
        const welcomeMsg = `Hello! 👋 I'm your ITER Assistant. I can help you with:

• 📊 Checking attendance & marks
• 📅 Finding timetable & schedules
• 📝 Previous year questions (PYQ)
• 🎉 Events & activities
• 💬 Forum & discussions
• 🏨 Hostel & mess info

Just type your question or click a quick action below!`;

        this.addMessage(welcomeMsg, 'bot');
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.innerHTML = text;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isLoading) return;

        // Add user message
        this.addMessage(message, 'user');
        this.input.value = '';
        this.isLoading = true;

        // Show typing indicator
        this.showTypingIndicator();

        // Get response
        setTimeout(async () => {
            const response = await this.getResponse(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
            this.isLoading = false;
        }, 500 + Math.random() * 500); // Slight delay for natural feel
    }

    async getResponse(message) {
        const lowerMessage = message.toLowerCase();

        // First, try to match from FAQ database
        for (const [key, faq] of Object.entries(this.faqDatabase)) {
            if (faq.keywords.some(keyword => lowerMessage.includes(keyword))) {
                return faq.answer;
            }
        }

        // Greeting responses
        if (this.isGreeting(lowerMessage)) {
            return this.getGreetingResponse();
        }

        // Try API call if FAQ doesn't match (optional - with fallback)
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ question: message })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.answer) {
                        return data.answer;
                    }
                }
            }
        } catch (error) {
            console.log('AI API not available, using fallback');
        }

        // Fallback response
        return this.getFallbackResponse(message);
    }

    isGreeting(message) {
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'];
        return greetings.some(g => message.includes(g));
    }

    getGreetingResponse() {
        const responses = [
            "Hello! 👋 How can I help you today? You can ask about attendance, marks, timetable, or any college-related queries!",
            "Hi there! 😊 I'm here to assist you. What would you like to know about?",
            "Hey! Ready to help you with your queries. Ask me about academics, events, hostel, or anything else!",
            "Good to see you! 🌟 How may I assist you today?"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getFallbackResponse(message) {
        return `I understand you're asking about "${message}". Here are some things I can help with:

<div class="faq-category">
    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='attendance'; document.getElementById('chatbotSend').click();">📊 Attendance & Marks</div>
    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='timetable'; document.getElementById('chatbotSend').click();">📅 Class Schedule</div>
    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='pyq'; document.getElementById('chatbotSend').click();">📝 Previous Year Questions</div>
    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='forum'; document.getElementById('chatbotSend').click();">💬 Student Forum</div>
    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='help'; document.getElementById('chatbotSend').click();">🆘 Contact Support</div>
</div>

Or you can visit the <a href="student-forum.html" class="nav-suggestion">💬 Forum</a> to ask your question to peers and faculty!`;
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on student pages
    if (window.location.pathname.includes('student') || 
        window.location.pathname.includes('dashboard') ||
        window.location.pathname === '/' ||
        window.location.pathname.includes('index.html')) {
        window.chatbot = new Chatbot();
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Chatbot;
}
