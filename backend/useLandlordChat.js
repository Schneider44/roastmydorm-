import { useState, useEffect, useRef } from 'react';
import { ref, push, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebase-config';

export const useLandlordChat = (chatId, landlordInfo, listingInfo) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat history from Firebase
  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);
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
      setIsLoading(false);
    });

    return () => {
      off(messagesRef, 'value', unsubscribe);
      setIsLoading(false);
    };
  }, [chatId, landlordInfo]);

  // Send message to Firebase
  const sendMessage = async (messageText, senderId) => {
    if (!messageText.trim() || !chatId) return;

    const messageData = {
      text: messageText.trim(),
      sender: 'student',
      senderId: senderId,
      timestamp: new Date().toISOString(),
      chatId: chatId,
      listingId: listingInfo.id,
      landlordId: landlordInfo.id
    };

    try {
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      await push(messagesRef, messageData);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
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

  // Get chat history for a specific conversation
  const getChatHistory = async (studentId, landlordId, listingId) => {
    try {
      const chatId = `${studentId}_${landlordId}_${listingId}`;
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      
      return new Promise((resolve) => {
        onValue(messagesRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const messagesList = Object.values(data).sort((a, b) => 
              new Date(a.timestamp) - new Date(b.timestamp)
            );
            resolve(messagesList);
          } else {
            resolve([]);
          }
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  };

  // Get all conversations for a student
  const getStudentConversations = async (studentId) => {
    try {
      const conversationsRef = ref(database, 'chats');
      
      return new Promise((resolve) => {
        onValue(conversationsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const conversations = Object.entries(data)
              .filter(([chatId]) => chatId.startsWith(studentId))
              .map(([chatId, chatData]) => ({
                chatId,
                ...chatData
              }));
            resolve(conversations);
          } else {
            resolve([]);
          }
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Error getting student conversations:', error);
      return [];
    }
  };

  // Get all conversations for a landlord
  const getLandlordConversations = async (landlordId) => {
    try {
      const conversationsRef = ref(database, 'chats');
      
      return new Promise((resolve) => {
        onValue(conversationsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const conversations = Object.entries(data)
              .filter(([chatId]) => chatId.includes(landlordId))
              .map(([chatId, chatData]) => ({
                chatId,
                ...chatData
              }));
            resolve(conversations);
          } else {
            resolve([]);
          }
        }, { onlyOnce: true });
      });
    } catch (error) {
      console.error('Error getting landlord conversations:', error);
      return [];
    }
  };

  return {
    messages,
    isTyping,
    isLoading,
    messagesEndRef,
    sendMessage,
    simulateLandlordResponse,
    getChatHistory,
    getStudentConversations,
    getLandlordConversations
  };
};
