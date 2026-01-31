import { useState } from 'react'
import '../styles/ChatSupport.css'

/**
 * ChatSupport Component
 * Handles live chat functionality with support team
 * Includes FAQ section
 */
function ChatSupport() {
  const [messages, setMessages] = useState([
    { id: 1, type: 'support', text: 'Hi there! 👋 How can we help you with finding or rating a dorm?' }
  ])
  const [input, setInput] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState(null)

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault()
    
    if (!input.trim()) return

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: input
    }
    
    setMessages([...messages, userMessage])
    setInput('')

    // Simulate support response after 800ms
    setTimeout(() => {
      const responses = [
        "Thanks for your message! Our team is reviewing your question.",
        "We're here to help! Can you provide more details?",
        "That's a great question! Let me help you with that.",
        "I understand. How can we assist you further?"
      ]
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      
      const supportMessage = {
        id: messages.length + 2,
        type: 'support',
        text: randomResponse
      }
      
      setMessages(prev => [...prev, supportMessage])
    }, 800)
  }

  // FAQ toggle handler
  const toggleFAQ = (index) => {
    setExpandedFAQ(expandedFAQ === index ? null : index)
  }

  const faqs = [
    {
      question: "How do I search for dorms in my city?",
      answer: "You can search for dorms by selecting your city from the home page. We currently have listings in Casablanca, Rabat, and Marrakech. Use the search bar to filter by university or location."
    },
    {
      question: "How do I rate a dorm or landlord?",
      answer: "After signing in, navigate to 'Start Rating' from the home page. You can rate dormitories and landlords based on your experience. Your honest reviews help other students make informed decisions."
    },
    {
      question: "Is my personal information safe?",
      answer: "Yes! We take data security seriously. Your personal information is encrypted and only shared with landlords when you express interest in a dorm."
    },
    {
      question: "How do I contact a landlord?",
      answer: "You can contact landlords directly through the 'Direct Contact' option on dorm listings. We provide their contact information and you can reach out via phone or email."
    },
    {
      question: "Can I find a roommate on RoastMyDorm?",
      answer: "Yes! We have a dedicated 'Find Your Roommate' feature. You can create a profile and search for compatible roommates."
    }
  ]

  return (
    <div className="chat-support-container">
      <div className="chat-support-header">
        <h1>RoastMyDorm Support Center</h1>
        <p>We're here to help! Get answers to your questions about dorms, ratings, and rentals.</p>
      </div>

      <div className="chat-support-content">
        {/* Chat Box */}
        <div className="chat-box">
          <div className="chat-box-header">
            <h2>💬 Live Chat</h2>
            <p>Chat with our support team</p>
          </div>

          <div className="chat-messages-container">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.type}`}>
                <div className={`chat-avatar ${msg.type}`}>
                  {msg.type === 'user' ? 'U' : 'S'}
                </div>
                <div className="message-content">
                  <div className={`message-bubble ${msg.type}`}>
                    {msg.text}
                  </div>
                  <div className="message-time">Just now</div>
                </div>
              </div>
            ))}
          </div>

          <form className="chat-input-section" onSubmit={handleSendMessage}>
            <textarea
              className="chat-input"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
              rows="1"
            />
            <button type="submit" className="chat-send-btn">
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>

        {/* Support Options */}
        <div className="support-options">
          <h3>Other Ways to Get Help</h3>
          <div className="options-grid">
            <div className="option-item">
              <h4><i className="fas fa-envelope"></i> Email Support</h4>
              <p>support@roastmydorm.com</p>
              <p style={{fontSize: '0.8rem', marginTop: '5px'}}>Response within 24 hours</p>
            </div>
            <div className="option-item">
              <h4><i className="fas fa-phone"></i> Call Us</h4>
              <p>+212 6 12 345 678</p>
              <p style={{fontSize: '0.8rem', marginTop: '5px'}}>Mon-Fri, 9 AM - 6 PM</p>
            </div>
            <div className="option-item">
              <h4><i className="fab fa-whatsapp"></i> WhatsApp</h4>
              <p>+212 6 12 345 678</p>
              <p style={{fontSize: '0.8rem', marginTop: '5px'}}>Quick responses available</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        
        {faqs.map((faq, index) => (
          <div key={index} className="faq-item">
            <div 
              className="faq-question"
              onClick={() => toggleFAQ(index)}
              style={{ cursor: 'pointer' }}
            >
              <i 
                className="fas fa-chevron-right"
                style={{
                  transform: expandedFAQ === index ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              ></i>
              {faq.question}
            </div>
            {expandedFAQ === index && (
              <div className="faq-answer show">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChatSupport
