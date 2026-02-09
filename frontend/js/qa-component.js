/**
 * Q&A Component for Dorm Pages
 * Handles questions and answers functionality
 */

class DormQA {
  constructor(dormId, containerSelector) {
    this.dormId = dormId;
    this.container = document.querySelector(containerSelector);
    this.questions = [];
    this.currentPage = 1;
    this.isLoading = false;
    
    if (this.container) {
      this.init();
    }
  }

  async init() {
    this.render();
    await this.loadQuestions();
  }

  render() {
    this.container.innerHTML = `
      <div class="qa-section">
        <div class="qa-header">
          <h3 class="qa-title">
            <i class="fas fa-question-circle"></i>
            Questions & Answers
          </h3>
          <button class="ask-question-btn" onclick="dormQA.showAskModal()">
            <i class="fas fa-plus"></i>
            Ask a Question
          </button>
        </div>
        
        <div class="qa-filters">
          <select id="qa-category" onchange="dormQA.filterByCategory()">
            <option value="">All Categories</option>
            <option value="amenities">Amenities</option>
            <option value="pricing">Pricing</option>
            <option value="location">Location</option>
            <option value="safety">Safety</option>
            <option value="landlord">Landlord</option>
            <option value="roommates">Roommates</option>
            <option value="utilities">Utilities</option>
            <option value="rules">Rules</option>
            <option value="move-in">Move-in</option>
            <option value="general">General</option>
          </select>
          
          <select id="qa-sort" onchange="dormQA.loadQuestions()">
            <option value="voteScore">Most Voted</option>
            <option value="createdAt">Newest</option>
            <option value="answersCount">Most Answered</option>
          </select>
        </div>
        
        <div class="qa-list" id="qa-list">
          <div class="qa-loading">
            <i class="fas fa-spinner fa-spin"></i>
            Loading questions...
          </div>
        </div>
        
        <div class="qa-pagination" id="qa-pagination"></div>
      </div>
      
      <!-- Ask Question Modal -->
      <div class="modal" id="ask-question-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h4>Ask a Question</h4>
            <button class="modal-close" onclick="dormQA.closeModal()">&times;</button>
          </div>
          <form id="ask-question-form" onsubmit="dormQA.submitQuestion(event)">
            <div class="form-group">
              <label for="question-title">Question Title</label>
              <input type="text" id="question-title" required maxlength="200" 
                placeholder="What would you like to know?">
            </div>
            <div class="form-group">
              <label for="question-content">Details</label>
              <textarea id="question-content" required maxlength="2000" rows="4"
                placeholder="Provide more details about your question..."></textarea>
            </div>
            <div class="form-group">
              <label for="question-category">Category</label>
              <select id="question-category" required>
                <option value="general">General</option>
                <option value="amenities">Amenities</option>
                <option value="pricing">Pricing</option>
                <option value="location">Location</option>
                <option value="safety">Safety</option>
                <option value="landlord">Landlord</option>
                <option value="roommates">Roommates</option>
                <option value="utilities">Utilities</option>
                <option value="rules">Rules</option>
                <option value="move-in">Move-in</option>
              </select>
            </div>
            <button type="submit" class="btn-primary">
              <i class="fas fa-paper-plane"></i>
              Post Question
            </button>
          </form>
        </div>
      </div>
    `;
  }

  async loadQuestions() {
    const listEl = document.getElementById('qa-list');
    listEl.innerHTML = '<div class="qa-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
      const category = document.getElementById('qa-category')?.value || '';
      const sortBy = document.getElementById('qa-sort')?.value || 'voteScore';
      
      const response = await fetch(
        `/api/questions/dorm/${this.dormId}?page=${this.currentPage}&category=${category}&sortBy=${sortBy}`
      );
      const data = await response.json();
      
      if (data.success) {
        this.questions = data.data;
        this.renderQuestions(data.data, data.pagination);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      listEl.innerHTML = '<div class="qa-error">Failed to load questions. Please try again.</div>';
    }
  }

  renderQuestions(questions, pagination) {
    const listEl = document.getElementById('qa-list');
    
    if (questions.length === 0) {
      listEl.innerHTML = `
        <div class="qa-empty">
          <i class="fas fa-comments"></i>
          <p>No questions yet. Be the first to ask!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = questions.map(q => this.renderQuestion(q)).join('');
    this.renderPagination(pagination);
  }

  renderQuestion(question) {
    const author = question.author;
    const answersCount = question.answersCount || 0;
    const hasAcceptedAnswer = question.answers?.some(a => a.isAccepted);
    
    return `
      <div class="qa-item" data-id="${question._id}">
        <div class="qa-votes">
          <button class="vote-btn upvote" onclick="dormQA.vote('${question._id}', true)">
            <i class="fas fa-chevron-up"></i>
          </button>
          <span class="vote-score">${question.voteScore || 0}</span>
          <button class="vote-btn downvote" onclick="dormQA.vote('${question._id}', false)">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
        
        <div class="qa-content">
          <div class="qa-header-row">
            <span class="qa-category-badge">${question.category}</span>
            ${hasAcceptedAnswer ? '<span class="qa-resolved-badge"><i class="fas fa-check"></i> Answered</span>' : ''}
          </div>
          
          <h4 class="qa-question-title" onclick="dormQA.toggleAnswers('${question._id}')">
            ${this.escapeHtml(question.title)}
          </h4>
          
          <p class="qa-question-content">${this.escapeHtml(question.content)}</p>
          
          <div class="qa-meta">
            <span class="qa-author">
              <img src="${author.profilePicture || '/images/default-avatar.png'}" alt="${author.firstName}">
              ${author.firstName} ${author.lastName}
              ${author.isVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Student"></i>' : ''}
            </span>
            <span class="qa-date">${SEO.timeAgo(question.createdAt)}</span>
            <span class="qa-answers-count">
              <i class="fas fa-comments"></i> ${answersCount} answer${answersCount !== 1 ? 's' : ''}
            </span>
            <span class="qa-views">
              <i class="fas fa-eye"></i> ${question.views || 0} views
            </span>
          </div>
          
          <div class="qa-answers" id="answers-${question._id}" style="display: none;">
            ${this.renderAnswers(question)}
          </div>
        </div>
      </div>
    `;
  }

  renderAnswers(question) {
    const answers = question.answers || [];
    
    if (answers.length === 0) {
      return `
        <div class="qa-no-answers">
          <p>No answers yet. Be the first to help!</p>
        </div>
        <form class="answer-form" onsubmit="dormQA.submitAnswer(event, '${question._id}')">
          <textarea placeholder="Write your answer..." required maxlength="2000"></textarea>
          <button type="submit" class="btn-secondary">
            <i class="fas fa-reply"></i> Post Answer
          </button>
        </form>
      `;
    }

    return `
      ${answers.map(a => this.renderAnswer(a, question._id, question.author._id)).join('')}
      <form class="answer-form" onsubmit="dormQA.submitAnswer(event, '${question._id}')">
        <textarea placeholder="Add your answer..." required maxlength="2000"></textarea>
        <button type="submit" class="btn-secondary">
          <i class="fas fa-reply"></i> Post Answer
        </button>
      </form>
    `;
  }

  renderAnswer(answer, questionId, questionAuthorId) {
    const author = answer.author;
    const currentUserId = this.getCurrentUserId();
    const canAccept = currentUserId === questionAuthorId && !answer.isAccepted;
    
    return `
      <div class="qa-answer ${answer.isAccepted ? 'accepted' : ''}" data-id="${answer._id}">
        <div class="answer-votes">
          <button class="vote-btn upvote" onclick="dormQA.voteAnswer('${questionId}', '${answer._id}', true)">
            <i class="fas fa-chevron-up"></i>
          </button>
          <span class="vote-score">${answer.voteScore || 0}</span>
          <button class="vote-btn downvote" onclick="dormQA.voteAnswer('${questionId}', '${answer._id}', false)">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
        
        <div class="answer-content">
          ${answer.isAccepted ? '<span class="accepted-badge"><i class="fas fa-check"></i> Accepted Answer</span>' : ''}
          <p>${this.escapeHtml(answer.content)}</p>
          
          <div class="answer-meta">
            <span class="answer-author">
              <img src="${author.profilePicture || '/images/default-avatar.png'}" alt="${author.firstName}">
              ${author.firstName} ${author.lastName}
              ${answer.isVerifiedResident ? '<span class="resident-badge" title="Verified Resident"><i class="fas fa-home"></i></span>' : ''}
            </span>
            <span class="answer-date">${SEO.timeAgo(answer.createdAt)}</span>
            ${canAccept ? `<button class="accept-btn" onclick="dormQA.acceptAnswer('${questionId}', '${answer._id}')">Accept Answer</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderPagination(pagination) {
    const paginationEl = document.getElementById('qa-pagination');
    if (!pagination || pagination.pages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= pagination.pages; i++) {
      html += `
        <button class="page-btn ${i === pagination.current ? 'active' : ''}" 
          onclick="dormQA.goToPage(${i})">${i}</button>
      `;
    }
    paginationEl.innerHTML = html;
  }

  toggleAnswers(questionId) {
    const answersEl = document.getElementById(`answers-${questionId}`);
    if (answersEl) {
      answersEl.style.display = answersEl.style.display === 'none' ? 'block' : 'none';
    }
  }

  showAskModal() {
    const modal = document.getElementById('ask-question-modal');
    modal.classList.add('show');
  }

  closeModal() {
    const modal = document.getElementById('ask-question-modal');
    modal.classList.remove('show');
  }

  async submitQuestion(event) {
    event.preventDefault();
    
    const title = document.getElementById('question-title').value;
    const content = document.getElementById('question-content').value;
    const category = document.getElementById('question-category').value;

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          title,
          content,
          dormId: this.dormId,
          category
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.closeModal();
        document.getElementById('ask-question-form').reset();
        await this.loadQuestions();
        this.showNotification('Question posted successfully!', 'success');
      } else {
        this.showNotification(data.message || 'Failed to post question', 'error');
      }
    } catch (error) {
      console.error('Error posting question:', error);
      this.showNotification('Failed to post question. Please try again.', 'error');
    }
  }

  async submitAnswer(event, questionId) {
    event.preventDefault();
    
    const textarea = event.target.querySelector('textarea');
    const content = textarea.value;

    try {
      const response = await fetch(`/api/questions/${questionId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ content })
      });

      const data = await response.json();
      
      if (data.success) {
        textarea.value = '';
        await this.loadQuestions();
        this.showNotification('Answer posted successfully!', 'success');
      } else {
        this.showNotification(data.message || 'Failed to post answer', 'error');
      }
    } catch (error) {
      console.error('Error posting answer:', error);
      this.showNotification('Failed to post answer. Please try again.', 'error');
    }
  }

  async vote(questionId, isUpvote) {
    try {
      const response = await fetch(`/api/questions/${questionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ isUpvote })
      });

      const data = await response.json();
      
      if (data.success) {
        const scoreEl = document.querySelector(`[data-id="${questionId}"] .vote-score`);
        if (scoreEl) {
          scoreEl.textContent = data.data.voteScore;
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  async voteAnswer(questionId, answerId, isUpvote) {
    try {
      const response = await fetch(`/api/questions/${questionId}/answers/${answerId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ isUpvote })
      });

      const data = await response.json();
      
      if (data.success) {
        const scoreEl = document.querySelector(`[data-id="${answerId}"] .vote-score`);
        if (scoreEl) {
          scoreEl.textContent = data.data.voteScore;
        }
      }
    } catch (error) {
      console.error('Error voting on answer:', error);
    }
  }

  async acceptAnswer(questionId, answerId) {
    try {
      const response = await fetch(`/api/questions/${questionId}/answers/${answerId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await this.loadQuestions();
        this.showNotification('Answer accepted!', 'success');
      }
    } catch (error) {
      console.error('Error accepting answer:', error);
    }
  }

  filterByCategory() {
    this.currentPage = 1;
    this.loadQuestions();
  }

  goToPage(page) {
    this.currentPage = page;
    this.loadQuestions();
  }

  getCurrentUserId() {
    // Get from localStorage or auth state
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user._id || null;
  }

  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a toast library
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// CSS styles for Q&A component
const qaStyles = `
  .qa-section {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin: 24px 0;
  }

  .qa-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .qa-title {
    font-size: 1.5rem;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ask-question-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s;
  }

  .ask-question-btn:hover {
    background: #5a67d8;
  }

  .qa-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .qa-filters select {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
  }

  .qa-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 12px;
    transition: box-shadow 0.2s;
  }

  .qa-item:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .qa-votes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .vote-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 4px 8px;
    transition: color 0.2s;
  }

  .vote-btn:hover {
    color: #667eea;
  }

  .vote-score {
    font-weight: 600;
    color: #374151;
  }

  .qa-content {
    flex: 1;
  }

  .qa-question-title {
    color: #1f2937;
    cursor: pointer;
    margin: 8px 0;
  }

  .qa-question-title:hover {
    color: #667eea;
  }

  .qa-question-content {
    color: #6b7280;
    margin-bottom: 12px;
  }

  .qa-category-badge {
    background: #e5e7eb;
    color: #374151;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: capitalize;
  }

  .qa-resolved-badge {
    background: #d1fae5;
    color: #059669;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .qa-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .qa-author img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }

  .verified-badge {
    color: #3b82f6;
    margin-left: 4px;
  }

  .qa-answers {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }

  .qa-answer {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .qa-answer.accepted {
    background: #ecfdf5;
    border: 1px solid #10b981;
  }

  .accepted-badge {
    color: #059669;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .answer-form {
    margin-top: 16px;
  }

  .answer-form textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    resize: vertical;
    min-height: 80px;
  }

  .answer-form button {
    margin-top: 8px;
  }

  .modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    justify-content: center;
    align-items: center;
  }

  .modal.show {
    display: flex;
  }

  .modal-content {
    background: white;
    padding: 24px;
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #374151;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .btn-primary {
    background: #667eea;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #e5e7eb;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    z-index: 1100;
    animation: slideIn 0.3s ease;
  }

  .notification.success { background: #10b981; }
  .notification.error { background: #ef4444; }
  .notification.info { background: #3b82f6; }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @media (max-width: 640px) {
    .qa-header {
      flex-direction: column;
      gap: 12px;
    }
    
    .qa-filters {
      flex-direction: column;
    }
    
    .qa-meta {
      flex-direction: column;
      gap: 8px;
    }
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = qaStyles;
document.head.appendChild(styleSheet);

// Export for use
window.DormQA = DormQA;
