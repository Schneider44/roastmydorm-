import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, off } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const ChatWindow = ({ 
  isOpen, 
  onClose, 
  landlordInfo, 
  listingInfo, 
  currentStudentId 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);

  // Generate unique chat ID
  const chatId = `${currentStudentId}_${landlordInfo.id}_${listingInfo.id}`;

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history from Firebase
  useEffect(() => {
    if (!isOpen) return;

    const messagesRef = ref(database, `chats/${chatId}/messages`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesList = Object.values(data).sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        setMessages(messagesList);
      } else {
        // No messages yet, show welcome message
        setMessages([{
          id: Date.now(),
          text: `Hello! I'm ${landlordInfo.name}, the landlord for this property. How can I help you today?`,
          sender: 'landlord',
          senderId: landlordInfo.id,
          timestamp: new Date().toISOString()
        }]);
      }
    });

    return () => off(messagesRef, 'value', unsubscribe);
  }, [isOpen, chatId, landlordInfo]);

  // Handle sending messages
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageData = {
      text: newMessage.trim(),
      sender: 'student',
      senderId: currentStudentId,
      timestamp: new Date().toISOString(),
      chatId: chatId,
      listingId: listingInfo.id,
      landlordId: landlordInfo.id
    };

    try {
      // Save message to Firebase
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      await push(messagesRef, messageData);
      
      setNewMessage('');
      
      // Simulate landlord response
      simulateLandlordResponse();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Simulate landlord response
  const simulateLandlordResponse = () => {
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      
      const responses = [
        "Hello! Thanks for your interest in my property. How can I help you?",
        "Hi there! I'm available to answer any questions about the apartment.",
        "Hello! Are you interested in scheduling a viewing?",
        "Hi! The apartment is still available. Would you like to know more details?",
        "Hello! I can provide more photos or arrange a virtual tour if you'd like.",
        "Hi there! The rent includes all utilities and WiFi. Any other questions?",
        "Hello! I'm flexible with move-in dates. What works best for you?",
        "Hi! The apartment is fully furnished and ready to move in. Interested?"
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      const responseData = {
        text: response,
        sender: 'landlord',
        senderId: landlordInfo.id,
        timestamp: new Date().toISOString(),
        chatId: chatId,
        listingId: listingInfo.id,
        landlordId: landlordInfo.id
      };
      
      // Save landlord response to Firebase
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      push(messagesRef, responseData);
    }, 1500 + Math.random() * 2000);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return time.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-md h-4/5 max-h-[700px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-5 flex items-center gap-4 relative">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
            {landlordInfo.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{landlordInfo.name}</h3>
            <p className="text-sm opacity-90">{landlordInfo.availability || 'Available'}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-5 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-5 bg-gray-50 overflow-y-auto flex flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-3 max-w-[80%] ${
                message.sender === 'student' ? 'self-end flex-row-reverse' : 'self-start'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                message.sender === 'student' 
                  ? 'bg-gradient-to-r from-green-500 to-green-600' 
                  : 'bg-gradient-to-r from-orange-500 to-orange-600'
              }`}>
                {message.sender === 'student' ? 'S' : landlordInfo.name.charAt(0).toUpperCase()}
              </div>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                message.sender === 'student'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
              }`}>
                {message.text}
                <div className={`text-xs mt-2 ${
                  message.sender === 'student' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-end gap-3 max-w-[80%] self-start">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {landlordInfo.name.charAt(0).toUpperCase()}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-gray-600 italic">
                  {landlordInfo.name} is typing
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-5 bg-white border-t border-gray-200 flex gap-3 items-end">
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 border-2 border-gray-200 rounded-full px-4 py-3 text-sm resize-none max-h-24 min-h-[44px] focus:outline-none focus:border-blue-500 transition-colors"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="w-11 h-11 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center hover:scale-105 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
