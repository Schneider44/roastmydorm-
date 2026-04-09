/**
 * RoastMyDorm AI Live Support Chatbot
 * Version: 1.0.0
 * 
 * AI Support Assistant for Moroccan student housing platform
 * Supports: English, French, Darija (Moroccan Arabic)
 */

class RoastMyDormChatbot {
    constructor(options = {}) {
        this.options = {
            containerId: options.containerId || 'roastmydorm-chatbot',
            position: options.position || 'bottom-right',
            primaryColor: options.primaryColor || '#e70909',
            platformName: options.platformName || 'RoastMyDorm',
            supportEmail: options.supportEmail || 'support@roastmydorm.com',
            ...options
        };

        this.isOpen = false;
        this.userType = null; // 'student', 'landlord', or null
        this.conversationHistory = [];
        this.currentLanguage = 'auto';
        this.awaitingEscalation = false;
        
        this.init();
    }

    init() {
        this.createWidget();
        this.loadConversationHistory();
        this.bindEvents();
        this.showWelcomeMessage();
    }

    // ============================================
    // WIDGET CREATION
    // ============================================

    createWidget() {
        const container = document.createElement('div');
        container.id = this.options.containerId;
        container.innerHTML = this.getWidgetHTML();
        document.body.appendChild(container);
        this.injectStyles();
    }

    getWidgetHTML() {
        return `
            <div class="rmd-chatbot-widget ${this.options.position}">
                <button class="rmd-chat-toggle" id="rmdChatToggle" title="Open Chat Support">
                    <svg class="rmd-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                    </svg>
                    <svg class="rmd-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span class="rmd-chat-badge" id="rmdChatBadge">1</span>
                </button>

                <div class="rmd-chat-window" id="rmdChatWindow">
                    <div class="rmd-chat-header">
                        <div class="rmd-header-info">
                            <div class="rmd-avatar">
                                <img src="roastmydorm_logo-removebg-preview.png" alt="RoastMyDorm" onerror="this.style.display='none'">
                                <span class="rmd-status-dot"></span>
                            </div>
                            <div class="rmd-header-text">
                                <h3>${this.options.platformName} Support</h3>
                                <p class="rmd-status">Online • Ready to help! 👋</p>
                            </div>
                        </div>
                        <div class="rmd-header-actions">
                            <button class="rmd-header-btn" id="rmdClearChat" title="Clear Chat">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                                </svg>
                            </button>
                            <button class="rmd-header-btn rmd-close-btn" id="rmdCloseChat" title="Close">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="rmd-chat-messages" id="rmdChatMessages">
                        <!-- Messages will be rendered here -->
                    </div>

                    <div class="rmd-quick-actions" id="rmdQuickActions">
                        <button class="rmd-quick-btn" data-action="student">🎓 I'm a Student</button>
                        <button class="rmd-quick-btn" data-action="landlord">🏠 I'm a Landlord</button>
                        <button class="rmd-quick-btn" data-action="help">❓ General Help</button>
                    </div>

                    <div class="rmd-chat-input-area">
                        <div class="rmd-typing-indicator" id="rmdTypingIndicator" style="display:none;">
                            <span></span><span></span><span></span>
                            <p>Support is typing...</p>
                        </div>
                        <div class="rmd-input-container">
                            <textarea
                                class="rmd-chat-input"
                                id="rmdChatInput"
                                placeholder="Type your message..."
                                rows="1"
                            ></textarea>
                            <button class="rmd-voice-btn" id="rmdVoiceBtn" title="Voice message">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="2" width="6" height="11" rx="3"></rect>
                                    <path d="M19 10a7 7 0 01-14 0"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            </button>
                            <button class="rmd-send-btn" id="rmdSendBtn" title="Send Message">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                        <p class="rmd-powered-by">Powered by ${this.options.platformName} AI</p>
                    </div>
                </div>
            </div>
        `;
    }

    injectStyles() {
        if (document.getElementById('rmd-chatbot-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'rmd-chatbot-styles';
        styles.textContent = `
            .rmd-chatbot-widget {
                position: fixed;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .rmd-chatbot-widget.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            .rmd-chatbot-widget.bottom-left {
                bottom: 20px;
                left: 20px;
            }

            .rmd-chat-toggle {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #0f766e 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                position: relative;
            }
            .rmd-chat-toggle:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 25px rgba(211, 13, 13, 0.99);
            }
            .rmd-chat-toggle svg {
                width: 28px;
                height: 28px;
                color: white;
            }
            .rmd-chat-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #dc2626;
                color: white;
                font-size: 12px;
                font-weight: 600;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
            }
            .rmd-chat-badge.hidden {
                display: none;
            }

            .rmd-chat-window {
                position: absolute;
                bottom: 75px;
                right: 0;
                width: 380px;
                height: 550px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                animation: rmdSlideUp 0.3s ease;
            }
            .rmd-chatbot-widget.bottom-left .rmd-chat-window {
                right: auto;
                left: 0;
            }
            .rmd-chat-window.open {
                display: flex;
            }

            @keyframes rmdSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .rmd-chat-header {
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #d41f12 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .rmd-header-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .rmd-avatar {
                width: 45px;
                height: 45px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            .rmd-avatar img {
                width: 35px;
                height: 35px;
                object-fit: contain;
            }
            .rmd-status-dot {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                background: #22c55e;
                border-radius: 50%;
                border: 2px solid white;
            }
            .rmd-header-text h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .rmd-status {
                margin: 2px 0 0;
                font-size: 12px;
                opacity: 0.9;
            }
            .rmd-header-actions {
                display: flex;
                gap: 8px;
            }
            .rmd-header-btn {
                width: 32px;
                height: 32px;
                border: none;
                background: rgba(255,255,255,0.15);
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .rmd-header-btn:hover {
                background: rgba(255,255,255,0.25);
            }
            .rmd-header-btn svg {
                width: 18px;
                height: 18px;
                color: white;
            }

            .rmd-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8fafc;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .rmd-message {
                display: flex;
                gap: 10px;
                max-width: 85%;
                animation: rmdMessageIn 0.3s ease;
            }
            @keyframes rmdMessageIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .rmd-message.bot {
                align-self: flex-start;
            }
            .rmd-message.user {
                align-self: flex-end;
                flex-direction: row-reverse;
            }
            .rmd-message-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                flex-shrink: 0;
            }
            .rmd-message.bot .rmd-message-avatar {
                background: ${this.options.primaryColor};
                color: white;
            }
            .rmd-message.user .rmd-message-avatar {
                background: #1e293b;
                color: white;
            }
            .rmd-message-content {
                padding: 12px 16px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.5;
            }
            .rmd-message.bot .rmd-message-content {
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                border-bottom-left-radius: 4px;
            }
            .rmd-message.user .rmd-message-content {
                background: ${this.options.primaryColor};
                color: white;
                border-bottom-right-radius: 4px;
            }
            .rmd-message-time {
                font-size: 10px;
                opacity: 0.6;
                margin-top: 6px;
            }

            .rmd-quick-actions {
                padding: 12px 20px;
                background: white;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .rmd-quick-actions.hidden {
                display: none;
            }
            .rmd-quick-btn {
                padding: 8px 14px;
                border: 1px solid #e2e8f0;
                background: white;
                border-radius: 20px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .rmd-quick-btn:hover {
                background: ${this.options.primaryColor};
                color: white;
                border-color: ${this.options.primaryColor};
            }

            .rmd-chat-input-area {
                padding: 12px 20px 16px;
                background: white;
                border-top: 1px solid #e2e8f0;
            }
            .rmd-typing-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                margin-bottom: 10px;
                background: #f1f5f9;
                border-radius: 12px;
                width: fit-content;
            }
            .rmd-typing-indicator span {
                width: 8px;
                height: 8px;
                background: ${this.options.primaryColor};
                border-radius: 50%;
                animation: rmdTypingDot 1.4s infinite;
            }
            .rmd-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .rmd-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            .rmd-typing-indicator p {
                margin: 0;
                font-size: 12px;
                color: #64748b;
            }
            @keyframes rmdTypingDot {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-4px); }
            }

            .rmd-input-container {
                display: flex;
                gap: 10px;
                align-items: flex-end;
            }
            .rmd-chat-input {
                flex: 1;
                padding: 12px 16px;
                border: 1px solid #e2e8f0;
                border-radius: 24px;
                font-size: 14px;
                resize: none;
                max-height: 100px;
                outline: none;
                transition: border-color 0.2s;
                font-family: inherit;
            }
            .rmd-chat-input:focus {
                border-color: ${this.options.primaryColor};
            }
            .rmd-voice-btn {
                width: 44px;
                height: 44px;
                border: 1.5px solid #e2e8f0;
                background: #fff;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .rmd-voice-btn:hover { background: #f1f5f9; }
            .rmd-voice-btn svg { width: 18px; height: 18px; color: #64748b; }
            .rmd-voice-btn.recording {
                background: #fee2e2;
                border-color: #e70909;
                animation: rmd-pulse 1s infinite;
            }
            .rmd-voice-btn.recording svg { color: #e70909; }
            @keyframes rmd-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            .rmd-send-btn {
                width: 44px;
                height: 44px;
                border: none;
                background: ${this.options.primaryColor};
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            .rmd-send-btn:hover {
                background: #e00f0f;
                transform: scale(1.05);
            }
            .rmd-send-btn svg {
                width: 20px;
                height: 20px;
                color: white;
            }
            .rmd-powered-by {
                margin: 10px 0 0;
                font-size: 11px;
                color: #94a3b8;
                text-align: center;
            }

            /* Safety Alert Styles */
            .rmd-safety-alert {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 12px;
                padding: 12px 16px;
                margin: 8px 0;
            }
            .rmd-safety-alert.danger {
                background: #fee2e2;
                border-color: #dc2626;
            }
            .rmd-safety-alert h4 {
                margin: 0 0 6px;
                font-size: 13px;
                color: #92400e;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .rmd-safety-alert.danger h4 {
                color: #dc2626;
            }
            .rmd-safety-alert p {
                margin: 0;
                font-size: 12px;
                color: #78350f;
            }
            .rmd-safety-alert.danger p {
                color: #991b1b;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .rmd-chat-window {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 85dvh !important;
                    max-height: none !important;
                    border-radius: 16px 16px 0 0 !important;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // ============================================
    // EVENT BINDING
    // ============================================

    bindEvents() {
        const toggle = document.getElementById('rmdChatToggle');
        const closeBtn = document.getElementById('rmdCloseChat');
        const clearBtn = document.getElementById('rmdClearChat');
        const sendBtn = document.getElementById('rmdSendBtn');
        const voiceBtn = document.getElementById('rmdVoiceBtn');
        const input = document.getElementById('rmdChatInput');
        const quickActions = document.getElementById('rmdQuickActions');

        toggle.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.toggleChat());
        clearBtn.addEventListener('click', () => this.clearChat());
        sendBtn.addEventListener('click', () => this.sendMessage());
        voiceBtn.addEventListener('click', () => this.toggleVoice());

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        input.addEventListener('input', () => this.autoResizeInput());

        quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('rmd-quick-btn')) {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            }
        });
    }

    toggleVoice() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
            return;
        }

        const voiceBtn = document.getElementById('rmdVoiceBtn');

        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ar-MA'; // Moroccan Arabic (Darija)

        this.isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.title = 'Stop recording';

        const input = document.getElementById('rmdChatInput');
        const originalPlaceholder = input.placeholder;
        input.placeholder = '🎙️ Listening...';

        this.recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            input.value = transcript;
            this.autoResizeInput();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.title = 'Voice message';
            input.placeholder = originalPlaceholder;
            // Auto-send if something was captured
            if (input.value.trim()) this.sendMessage();
        };

        this.recognition.onerror = (e) => {
            this.isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.title = 'Voice message';
            input.placeholder = originalPlaceholder;
            if (e.error !== 'aborted') alert('Microphone error: ' + e.error);
        };

        this.recognition.start();
    }

    // ============================================
    // CHAT FUNCTIONALITY
    // ============================================

    toggleChat() {
        this.isOpen = !this.isOpen;
        const chatWindow = document.getElementById('rmdChatWindow');
        const chatIcon = document.querySelector('.rmd-chat-icon');
        const closeIcon = document.querySelector('.rmd-close-icon');
        const badge = document.getElementById('rmdChatBadge');

        if (this.isOpen) {
            chatWindow.classList.add('open');
            chatIcon.style.display = 'none';
            closeIcon.style.display = 'block';
            badge.classList.add('hidden');
            document.getElementById('rmdChatInput').focus();
        } else {
            chatWindow.classList.remove('open');
            chatIcon.style.display = 'block';
            closeIcon.style.display = 'none';
        }
    }

    showWelcomeMessage() {
        if (this.conversationHistory.length === 0) {
            this.addBotMessage(this.getGreeting());
        } else {
            this.renderMessages();
        }
    }

    getGreeting() {
        return `Hello 👋 Welcome to ${this.options.platformName}!

Are you looking for student housing or listing a property?

مرحبا 👋 مرحبا بك ف ${this.options.platformName}!
واش كتقلب على سكن للطلبة ولا باغي تعلن على شي دار؟

Bonjour 👋 Bienvenue sur ${this.options.platformName}!
Cherchez-vous un logement étudiant ou souhaitez-vous publier une annonce?`;
    }

    handleQuickAction(action) {
        const messages = {
            student: "🎓 I'm a student looking for housing",
            landlord: "🏠 I'm a landlord listing a property",
            help: "❓ I need general help"
        };

        const userMessage = messages[action];
        this.addUserMessage(userMessage);
        this.userType = action === 'help' ? null : action;

        document.getElementById('rmdQuickActions').classList.add('hidden');
        
        this.showTyping();
        setTimeout(() => {
            this.hideTyping();
            this.addBotMessage(this.getResponseForUserType(action));
        }, 1000);
    }

    getResponseForUserType(type) {
        if (type === 'student') {
            this.userType = 'student';
            return `Great! I'm here to help you find the perfect student housing! 🎓

How can I assist you today?
• 🔍 Search for rentals
• 📖 Understand listings
• 💳 Payment guidance
• 🔒 Safety information
• ❌ Cancellation help

Just type your question or choose an option!

---
كيفاش نقدر نعاونك اليوم؟
• البحث على سكن
• فهم الإعلانات
• معلومات الدفع
• معلومات السلامة`;
        } else if (type === 'landlord') {
            this.userType = 'landlord';
            return `Welcome, property owner! 🏠

I can help you with:
• 📝 Creating listings
• ✅ Verification process
• 📊 Managing bookings
• ✏️ Updating property details

What would you like to do?

---
مرحبا! كيفاش نقدر نعاونك؟
• إنشاء إعلان جديد
• عملية التحقق
• إدارة الحجوزات`;
        } else {
            return `Of course! I can help with:
• 🔐 Login and account issues
• 👤 Profile updates
• ⚙️ Technical guidance
• 🚨 Reporting suspicious activity

What do you need help with?

---
بالطبع! نقدر نعاونك في:
• مشاكل تسجيل الدخول
• تحديث الملف الشخصي
• المساعدة التقنية`;
        }
    }

    sendMessage() {
        const input = document.getElementById('rmdChatInput');
        const message = input.value.trim();

        if (!message) return;

        this.addUserMessage(message);
        input.value = '';
        this.autoResizeInput();

        this.showTyping();
        
        // Process message and generate response
        setTimeout(() => {
            this.hideTyping();
            const response = this.generateResponse(message);
            this.addBotMessage(response);
        }, 1000 + Math.random() * 1000);
    }

    addUserMessage(text) {
        const message = {
            type: 'user',
            text: text,
            timestamp: new Date()
        };
        this.conversationHistory.push(message);
        this.saveConversationHistory();
        this.renderMessages();
    }

    addBotMessage(text, options = {}) {
        const message = {
            type: 'bot',
            text: text,
            timestamp: new Date(),
            ...options
        };
        this.conversationHistory.push(message);
        this.saveConversationHistory();
        this.renderMessages();
    }

    renderMessages() {
        const container = document.getElementById('rmdChatMessages');
        container.innerHTML = '';

        this.conversationHistory.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `rmd-message ${msg.type}`;
            
            messageEl.innerHTML = `
                <div class="rmd-message-avatar">${msg.type === 'bot' ? '🤖' : '👤'}</div>
                <div class="rmd-message-content">
                    ${this.formatMessage(msg.text)}
                    <div class="rmd-message-time">${this.formatTime(msg.timestamp)}</div>
                </div>
            `;
            
            container.appendChild(messageEl);
        });

        container.scrollTop = container.scrollHeight;
    }

    formatMessage(text) {
        // Convert line breaks to <br>
        let formatted = text.replace(/\n/g, '<br>');
        // Convert bullet points
        formatted = formatted.replace(/• /g, '&#8226; ');
        return formatted;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    showTyping() {
        document.getElementById('rmdTypingIndicator').style.display = 'flex';
        document.getElementById('rmdChatMessages').scrollTop = document.getElementById('rmdChatMessages').scrollHeight;
    }

    hideTyping() {
        document.getElementById('rmdTypingIndicator').style.display = 'none';
    }

    autoResizeInput() {
        const input = document.getElementById('rmdChatInput');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.conversationHistory = [];
            this.userType = null;
            this.saveConversationHistory();
            document.getElementById('rmdQuickActions').classList.remove('hidden');
            this.showWelcomeMessage();
        }
    }

    // ============================================
    // AI RESPONSE GENERATION
    // ============================================

    generateResponse(userMessage) {
        const msg = userMessage.toLowerCase();
        const lang = this.detectLanguage(userMessage);

        // Safety Check - Detect potential scam situations
        if (this.detectScamKeywords(msg)) {
            return this.getSafetyWarning(lang);
        }

        // Check for escalation triggers
        if (this.shouldEscalate(msg)) {
            return this.getEscalationResponse(lang);
        }

        // Language-specific greetings
        if (this.isGreeting(msg)) {
            return this.getGreetingResponse(lang);
        }

        // Student-specific queries
        if (this.userType === 'student' || this.detectStudentIntent(msg)) {
            return this.handleStudentQuery(msg, lang);
        }

        // Landlord-specific queries
        if (this.userType === 'landlord' || this.detectLandlordIntent(msg)) {
            return this.handleLandlordQuery(msg, lang);
        }

        // General queries
        return this.handleGeneralQuery(msg, lang);
    }

    detectLanguage(text) {
        // Darija/Arabic detection
        if (/[\u0600-\u06FF]/.test(text)) {
            return 'darija';
        }
        // French detection (common French words)
        if (/\b(je|vous|bonjour|merci|comment|appartement|louer|cherche|logement)\b/i.test(text)) {
            return 'french';
        }
        return 'english';
    }

    isGreeting(msg) {
        const greetings = [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'bonjour', 'salut', 'bonsoir',
            'مرحبا', 'سلام', 'السلام عليكم', 'اهلا', 'صباح الخير'
        ];
        return greetings.some(g => msg.includes(g));
    }

    getGreetingResponse(lang) {
        const responses = {
            english: `Hello! 👋 Welcome to ${this.options.platformName}!

How can I help you today? Are you:
• Looking for student housing? 🎓
• Listing a property? 🏠
• Need general support? ❓`,
            
            french: `Bonjour! 👋 Bienvenue sur ${this.options.platformName}!

Comment puis-je vous aider? Êtes-vous:
• À la recherche d'un logement étudiant? 🎓
• Propriétaire souhaitant publier une annonce? 🏠
• Besoin d'aide générale? ❓`,
            
            darija: `مرحبا! 👋 مرحبا بك ف ${this.options.platformName}!

كيفاش نقدر نعاونك اليوم؟
• كتقلب على سكن للطلبة؟ 🎓
• باغي تعلن على شي دار؟ 🏠
• محتاج مساعدة عامة؟ ❓`
        };
        return responses[lang] || responses.english;
    }

    detectStudentIntent(msg) {
        const keywords = [
            'student', 'dorm', 'room', 'rent', 'housing', 'apartment', 'studio', 'book', 'search', 'find',
            'étudiant', 'chambre', 'louer', 'appartement', 'cherche', 'logement',
            'طالب', 'سكن', 'غرفة', 'كراء', 'شقة', 'نقلب'
        ];
        return keywords.some(k => msg.includes(k));
    }

    detectLandlordIntent(msg) {
        const keywords = [
            'list', 'property', 'landlord', 'owner', 'publish', 'post', 'my apartment', 'my property',
            'propriétaire', 'publier', 'annonce', 'mon appartement',
            'مول الدار', 'إعلان', 'داري', 'شقتي'
        ];
        return keywords.some(k => msg.includes(k));
    }

    handleStudentQuery(msg, lang) {
        // Search/Find housing
        if (/\b(search|find|looking|cherche|نقلب|كنقلب)\b/i.test(msg)) {
            return this.getSearchHelpResponse(lang);
        }

        // Booking questions
        if (/\b(book|reserve|réserver|حجز)\b/i.test(msg)) {
            return this.getBookingHelpResponse(lang);
        }

        // Price/Budget questions
        if (/\b(price|cost|budget|how much|combien|ثمن|سعر|بشحال)\b/i.test(msg)) {
            return this.getPriceHelpResponse(lang);
        }

        // Verification questions
        if (/\b(verify|verified|safe|trust|vérifié|sûr|موثوق|مضمون)\b/i.test(msg)) {
            return this.getVerificationHelpResponse(lang);
        }

        // Cancel questions
        if (/\b(cancel|cancellation|annuler|إلغاء)\b/i.test(msg)) {
            return this.getCancellationHelpResponse(lang);
        }

        // Payment questions
        if (/\b(pay|payment|money|payer|argent|خلص|فلوس)\b/i.test(msg)) {
            return this.getPaymentSafetyResponse(lang);
        }

        // City-specific
        if (/\b(rabat|الرباط)\b/i.test(msg)) {
            return this.getCityResponse('rabat', lang);
        }
        if (/\b(casablanca|casa|كازا|الدار البيضاء)\b/i.test(msg)) {
            return this.getCityResponse('casablanca', lang);
        }
        if (/\b(marrakech|marrakesh|مراكش)\b/i.test(msg)) {
            return this.getCityResponse('marrakech', lang);
        }

        return this.getDefaultStudentResponse(lang);
    }

    handleLandlordQuery(msg, lang) {
        // Creating listings
        if (/\b(create|add|post|list|publish|créer|ajouter|publier|نزيد|نعلن)\b/i.test(msg)) {
            return this.getCreateListingResponse(lang);
        }

        // Verification
        if (/\b(verify|verification|vérifié|التحقق|موثوق)\b/i.test(msg)) {
            return this.getLandlordVerificationResponse(lang);
        }

        // Edit listing
        if (/\b(edit|update|change|modify|modifier|changer|بدل|غير)\b/i.test(msg)) {
            return this.getEditListingResponse(lang);
        }

        // Bookings
        if (/\b(booking|reservation|manage|حجز|إدارة)\b/i.test(msg)) {
            return this.getManageBookingsResponse(lang);
        }

        return this.getDefaultLandlordResponse(lang);
    }

    handleGeneralQuery(msg, lang) {
        // Login/Account issues
        if (/\b(login|signin|sign in|account|password|connexion|compte|mot de passe|دخول|حساب|كلمة السر)\b/i.test(msg)) {
            return this.getAccountHelpResponse(lang);
        }

        // Technical issues
        if (/\b(error|bug|problem|issue|not working|erreur|problème|مشكل|خطأ)\b/i.test(msg)) {
            return this.getTechnicalHelpResponse(lang);
        }

        // Thanks
        if (/\b(thank|thanks|merci|شكرا)\b/i.test(msg)) {
            return this.getThanksResponse(lang);
        }

        return this.getDefaultResponse(lang);
    }

    // ============================================
    // RESPONSE TEMPLATES
    // ============================================

    getSearchHelpResponse(lang) {
        const responses = {
            english: `Here's how to find housing:

1. 🔍 Use the search filters on our homepage
2. 📍 Select your preferred city
3. 💰 Set your budget range
4. 🏠 Choose housing type (studio, shared, etc.)
5. ✅ Look for "Verified" badges for trusted listings

Would you like me to help you search for a specific city?`,
            
            french: `Voici comment trouver un logement:

1. 🔍 Utilisez les filtres de recherche sur notre page d'accueil
2. 📍 Sélectionnez votre ville préférée
3. 💰 Définissez votre budget
4. 🏠 Choisissez le type de logement
5. ✅ Recherchez les badges "Vérifié"

Voulez-vous que je vous aide à chercher dans une ville spécifique?`,
            
            darija: `هاكيفاش تقدر تلقى سكن:

1. 🔍 استعمل الفلتر ف الصفحة الرئيسية
2. 📍 اختار المدينة لي بغيتي
3. 💰 حدد الميزانية ديالك
4. 🏠 اختار نوع السكن
5. ✅ دور على الإعلانات الموثوقة

بغيتي نعاونك نقلب ف شي مدينة معينة؟`
        };
        return responses[lang] || responses.english;
    }

    getBookingHelpResponse(lang) {
        const responses = {
            english: `To book a rental:

1. 📖 Open the listing you like
2. 📅 Check availability dates
3. 💬 Click "Contact Landlord" to ask questions
4. ✅ Click "Book Now" or "Request Booking"
5. 💳 Follow the payment instructions

⚠️ Safety Tip: Always pay face-to-face with the landlord. Never send money via WhatsApp!`,
            
            french: `Pour réserver un logement:

1. 📖 Ouvrez l'annonce qui vous intéresse
2. 📅 Vérifiez les dates de disponibilité
3. 💬 Cliquez sur "Contacter" pour poser des questions
4. ✅ Cliquez sur "Réserver"
5. 💳 Suivez les instructions de paiement

⚠️ Conseil: Payez toujours en face-à-face!`,
            
            darija: `باش تحجز سكن:

1. 📖 فتح الإعلان لي عجبك
2. 📅 شوف الأوقات المتاحة
3. 💬 تواصل مع مول الدار
4. ✅ كليك على "احجز"
5. 💳 تبع التعليمات ديال الدفع

⚠️ نصيحة: خلص وجها لوجه مع مول الدار!`
        };
        return responses[lang] || responses.english;
    }

    getPriceHelpResponse(lang) {
        const responses = {
            english: `Our listings range from 1,500 MAD to 5,000+ MAD per month, depending on:

• 📍 Location (city center vs. suburbs)
• 🏠 Type (shared room, studio, apartment)
• ✨ Amenities (WiFi, AC, furnished)

Use the budget filter to see options in your price range!

What's your budget? I can suggest the best options.`,
            
            french: `Nos logements varient de 1 500 MAD à 5 000+ MAD par mois, selon:

• 📍 Emplacement
• 🏠 Type de logement
• ✨ Équipements

Utilisez le filtre budget pour voir les options!

Quel est votre budget?`,
            
            darija: `الأسعار ديالنا من 1,500 درهم حتى 5,000+ درهم ف الشهر، على حساب:

• 📍 البلاصة
• 🏠 نوع السكن
• ✨ التجهيزات

استعمل فلتر الميزانية!

شحال الميزانية ديالك؟`
        };
        return responses[lang] || responses.english;
    }

    getVerificationHelpResponse(lang) {
        const responses = {
            english: `✅ Verified Listings are checked by our team:

• Property photos are confirmed
• Landlord identity verified
• Location accuracy checked
• Price transparency ensured

Look for the ✅ Verified badge on listings for extra safety!

Need to report a suspicious listing? Let me know.`,
            
            french: `✅ Les annonces vérifiées sont contrôlées:

• Photos confirmées
• Identité du propriétaire vérifiée
• Localisation exacte
• Prix transparent

Recherchez le badge ✅ Vérifié!`,
            
            darija: `✅ الإعلانات الموثوقة محققة من الفريق ديالنا:

• صور مأكدة
• هوية مول الدار متحققة
• المكان صحيح
• الثمن واضح

دور على علامة ✅ موثوق!`
        };
        return responses[lang] || responses.english;
    }

    getCancellationHelpResponse(lang) {
        return `Cancellation depends on the landlord's policy:

📋 Standard Policy: Free cancellation 48h before check-in
⚠️ Some listings may have stricter policies

Check the listing details for specific cancellation terms.

Need to cancel a booking? Contact the landlord directly through our chat feature.`;
    }

    getPaymentSafetyResponse(lang) {
        const responses = {
            english: `🔒 Payment Safety Rules:

✅ DO:
• Pay the landlord face-to-face
• Get a receipt or contract
• Verify the property before paying
• Use our secure booking system

❌ DON'T:
• Send money via WhatsApp
• Pay cash deposits without meeting
• Transfer money to strangers
• Pay before visiting the property

If someone asks you to pay outside the platform, report them immediately!`,
            
            french: `🔒 Règles de Sécurité pour le Paiement:

✅ À FAIRE:
• Payer en face-à-face
• Obtenir un reçu
• Vérifier le bien avant de payer

❌ À ÉVITER:
• Envoyer de l'argent via WhatsApp
• Payer sans voir le logement

Signalez tout comportement suspect!`,
            
            darija: `🔒 قواعد السلامة ف الدفع:

✅ دير:
• خلص وجها لوجه مع مول الدار
• خذ وصل أو عقد
• شوف الدار قبل ما تخلص

❌ ما ديرش:
• ما تصيفطش الفلوس ب واتساب
• ما تخلصش بلا ما تشوف الدار

إلا شي واحد طلب منك تخلص برا المنصة، بلغ عليه!`
        };
        return responses[lang] || responses.english;
    }

    getCityResponse(city, lang) {
        const cityData = {
            rabat: {
                english: `🏛️ Rabat has excellent student housing options!

Popular areas:
• Agdal - Close to universities
• Hassan - Central location
• Hay Riad - Modern apartments

Would you like to see listings in Rabat? Visit our Rabat page!`,
                link: 'rabat-dorms.html'
            },
            casablanca: {
                english: `🌆 Casablanca - Morocco's largest city!

Popular areas:
• Maarif - Urban & central
• Anfa - Premium options
• Hay Hassani - Budget-friendly

Check out our Casablanca listings!`,
                link: 'casablanca-dorms.html'
            },
            marrakech: {
                english: `🕌 Marrakech - The Red City!

Popular areas:
• Gueliz - Modern center
• Hivernage - Near universities
• Targa - Quiet residential

Explore our Marrakech options!`,
                link: 'marrakech-dorms.html'
            }
        };

        const data = cityData[city] || cityData.rabat;
        return data.english + `\n\n🔗 [View ${city.charAt(0).toUpperCase() + city.slice(1)} Listings](/${data.link})`;
    }

    getDefaultStudentResponse(lang) {
        return `I'm here to help you find the perfect student housing! 🎓

You can ask me about:
• 🔍 How to search for rentals
• 💰 Price ranges and budgets
• ✅ Verified listings
• 📅 How to book
• 🔒 Payment safety

What would you like to know?`;
    }

    getCreateListingResponse(lang) {
        return `Here's how to create a listing:

1. 📝 Create an account or log in
2. ➕ Click "Add Listing" in your dashboard
3. 📸 Upload high-quality photos
4. 📋 Fill in property details (location, price, amenities)
5. ✅ Submit for verification

Tip: Listings with more photos and detailed descriptions get more views!

Need help with any step?`;
    }

    getLandlordVerificationResponse(lang) {
        return `To get verified as a landlord:

1. 📄 Submit your ID (CIN or passport)
2. 🏠 Provide proof of property ownership
3. 📸 Upload real photos of your property
4. ⏳ Wait for our team to review (24-48 hours)

Verified landlords get:
• ✅ Trust badge on listings
• 📈 Better visibility
• 💬 Priority support

Would you like to start the verification process?`;
    }

    getEditListingResponse(lang) {
        return `To edit your listing:

1. 🔐 Log in to your account
2. 📊 Go to your Dashboard
3. 🏠 Find the listing you want to edit
4. ✏️ Click "Edit"
5. 💾 Make changes and save

You can update:
• Photos
• Price
• Availability
• Description
• Amenities`;
    }

    getManageBookingsResponse(lang) {
        return `To manage bookings:

1. 📊 Go to your Dashboard
2. 📅 Click on "Bookings"
3. ✅ Accept or decline requests
4. 💬 Chat with tenants

Tips:
• Respond quickly to booking requests
• Keep your calendar updated
• Communicate clearly with tenants`;
    }

    getDefaultLandlordResponse(lang) {
        return `I'm here to help you as a property owner! 🏠

I can assist with:
• 📝 Creating new listings
• ✅ Getting verified
• 📊 Managing bookings
• ✏️ Updating property details

What would you like to do?`;
    }

    getAccountHelpResponse(lang) {
        return `Need help with your account? I can assist!

Common issues:
• 🔑 Forgot password? Click "Forgot Password" on login
• 📧 Can't receive emails? Check spam folder
• 👤 Update profile? Go to Settings > Profile
• 🔒 Account locked? Contact support

If you're still having issues, I can connect you with our support team.`;
    }

    getTechnicalHelpResponse(lang) {
        return `Sorry to hear you're having technical issues!

Try these steps:
1. 🔄 Refresh the page
2. 🗑️ Clear browser cache
3. 🌐 Try a different browser
4. 📱 Try on mobile/desktop

If the problem persists, please describe the issue and I'll escalate to our technical team.`;
    }

    getThanksResponse(lang) {
        const responses = {
            english: `You're welcome! 😊 Is there anything else I can help you with?`,
            french: `De rien! 😊 Y a-t-il autre chose que je peux faire pour vous?`,
            darija: `على الرحب والسعة! 😊 واش كاين شي حاجة أخرى نقدر نعاونك فيها؟`
        };
        return responses[lang] || responses.english;
    }

    getDefaultResponse(lang) {
        return `Thanks for your message! 💬

I'm here to help with:
• 🎓 Student housing search
• 🏠 Landlord services
• 🔐 Account issues
• ⚙️ Technical support

Could you tell me more about what you need? Or choose one of the quick options below!`;
    }

    // ============================================
    // SAFETY & ESCALATION
    // ============================================

    detectScamKeywords(msg) {
        const scamKeywords = [
            'whatsapp', 'western union', 'moneygram', 'wire transfer', 'send money',
            'pay before', 'urgent payment', 'deposit now', 'bank transfer only',
            'واتساب', 'صيفط الفلوس', 'خلص دابا', 'تحويل بنكي'
        ];
        return scamKeywords.some(keyword => msg.includes(keyword));
    }

    getSafetyWarning(lang) {
        return `⚠️ SAFETY ALERT ⚠️

I noticed you mentioned something that could be a scam risk.

🚨 IMPORTANT SAFETY RULES:
✅ Only pay the landlord FACE-TO-FACE
✅ Meet at the property before paying
✅ Get a written receipt/contract
✅ Use verified listings

❌ NEVER:
• Send money via WhatsApp or cash apps
• Pay deposits without visiting
• Transfer to unknown accounts
• Pay before meeting the landlord

If someone is pressuring you for payment outside our platform, please report them immediately!

Would you like to report suspicious activity? Type "report" and I'll help you.`;
    }

    shouldEscalate(msg) {
        const escalationTriggers = [
            'fraud', 'scam', 'cheated', 'stolen', 'legal', 'lawyer', 'police',
            'very angry', 'terrible', 'worst', 'unacceptable', 'demand refund',
            'fraude', 'arnaque', 'volé', 'avocat',
            'نصب', 'احتيال', 'سرقة', 'محامي', 'بوليس'
        ];
        return escalationTriggers.some(trigger => msg.includes(trigger));
    }

    getEscalationResponse(lang) {
        this.awaitingEscalation = true;
        return `🚨 I understand this is a serious matter.

I'm escalating your case to our human support team right now. They will contact you within 24 hours.

Please provide:
1. Your email or phone number
2. Details of the issue
3. Any evidence (screenshots, messages)

Our team takes fraud and safety issues very seriously.

📧 Email: ${this.options.supportEmail}
📞 You can also call during business hours.

Is there anything else you'd like to add to your report?`;
    }

    // ============================================
    // STORAGE
    // ============================================

    saveConversationHistory() {
        try {
            localStorage.setItem('rmd_chat_history', JSON.stringify(this.conversationHistory));
        } catch (e) {
            console.warn('Could not save chat history:', e);
        }
    }

    loadConversationHistory() {
        try {
            const saved = localStorage.getItem('rmd_chat_history');
            if (saved) {
                this.conversationHistory = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load chat history:', e);
            this.conversationHistory = [];
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if not already done
    if (!window.roastMyDormChat) {
        window.roastMyDormChat = new RoastMyDormChatbot({
            platformName: 'RoastMyDorm',
            primaryColor: '#10b981',
            position: 'bottom-right',
            supportEmail: 'support@roastmydorm.com'
        });
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoastMyDormChatbot;
}
