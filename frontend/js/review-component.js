/**
 * Review Component with Voting
 * Handles review display, voting, and submission
 */

class ReviewSystem {
  constructor(dormId, containerSelector) {
    this.dormId = dormId;
    this.container = document.querySelector(containerSelector);
    this.reviews = [];
    this.currentPage = 1;
    this.filters = {
      rating: null,
      verified: false,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    if (this.container) {
      this.init();
    }
  }

  async init() {
    this.render();
    await this.loadReviews();
  }

  render() {
    this.container.innerHTML = `
      <div class="reviews-section">
        <div class="reviews-header">
          <h3 class="reviews-title">
            <i class="fas fa-star"></i>
            Reviews & Ratings
          </h3>
          <button class="write-review-btn" onclick="reviewSystem.showReviewModal()">
            <i class="fas fa-pen"></i>
            Write a Review
          </button>
        </div>
        
        <!-- Rating Summary -->
        <div class="rating-summary" id="rating-summary">
          <!-- Will be populated dynamically -->
        </div>
        
        <!-- Filters -->
        <div class="reviews-filters">
          <div class="filter-group">
            <label>Filter by rating:</label>
            <div class="rating-filter-buttons">
              <button class="rating-filter-btn active" data-rating="" onclick="reviewSystem.filterByRating(null)">All</button>
              <button class="rating-filter-btn" data-rating="5" onclick="reviewSystem.filterByRating(5)">5★</button>
              <button class="rating-filter-btn" data-rating="4" onclick="reviewSystem.filterByRating(4)">4★</button>
              <button class="rating-filter-btn" data-rating="3" onclick="reviewSystem.filterByRating(3)">3★</button>
              <button class="rating-filter-btn" data-rating="2" onclick="reviewSystem.filterByRating(2)">2★</button>
              <button class="rating-filter-btn" data-rating="1" onclick="reviewSystem.filterByRating(1)">1★</button>
            </div>
          </div>
          
          <div class="filter-group">
            <label>
              <input type="checkbox" id="verified-filter" onchange="reviewSystem.toggleVerifiedFilter()">
              Verified students only
            </label>
          </div>
          
          <div class="filter-group">
            <select id="sort-filter" onchange="reviewSystem.changeSort()">
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="helpful-desc">Most helpful</option>
              <option value="rating-desc">Highest rated</option>
              <option value="rating-asc">Lowest rated</option>
            </select>
          </div>
        </div>
        
        <!-- Reviews List -->
        <div class="reviews-list" id="reviews-list">
          <div class="reviews-loading">
            <i class="fas fa-spinner fa-spin"></i>
            Loading reviews...
          </div>
        </div>
        
        <!-- Pagination -->
        <div class="reviews-pagination" id="reviews-pagination"></div>
      </div>
      
      <!-- Write Review Modal -->
      <div class="modal" id="review-modal">
        <div class="modal-content review-modal-content">
          <div class="modal-header">
            <h4>Write a Review</h4>
            <button class="modal-close" onclick="reviewSystem.closeReviewModal()">&times;</button>
          </div>
          <form id="review-form" onsubmit="reviewSystem.submitReview(event)">
            <div class="form-group">
              <label for="review-title">Review Title *</label>
              <input type="text" id="review-title" required maxlength="100" 
                placeholder="Summarize your experience">
            </div>
            
            <div class="rating-inputs">
              <div class="rating-input-group">
                <label>Overall Rating *</label>
                <div class="star-input" data-field="overall">
                  ${this.renderStarInput('overall')}
                </div>
              </div>
              
              <div class="rating-categories">
                <div class="rating-input-group">
                  <label>Cleanliness</label>
                  <div class="star-input" data-field="cleanliness">
                    ${this.renderStarInput('cleanliness')}
                  </div>
                </div>
                <div class="rating-input-group">
                  <label>Safety</label>
                  <div class="star-input" data-field="safety">
                    ${this.renderStarInput('safety')}
                  </div>
                </div>
                <div class="rating-input-group">
                  <label>Location</label>
                  <div class="star-input" data-field="location">
                    ${this.renderStarInput('location')}
                  </div>
                </div>
                <div class="rating-input-group">
                  <label>Landlord</label>
                  <div class="star-input" data-field="landlord">
                    ${this.renderStarInput('landlord')}
                  </div>
                </div>
                <div class="rating-input-group">
                  <label>Value for Money</label>
                  <div class="star-input" data-field="value">
                    ${this.renderStarInput('value')}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label for="review-content">Your Review *</label>
              <textarea id="review-content" required maxlength="2000" rows="6"
                placeholder="Share details of your experience living here..."></textarea>
              <span class="char-count"><span id="content-chars">0</span>/2000</span>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="review-pros">Pros (one per line)</label>
                <textarea id="review-pros" rows="3" placeholder="What did you like?"></textarea>
              </div>
              <div class="form-group">
                <label for="review-cons">Cons (one per line)</label>
                <textarea id="review-cons" rows="3" placeholder="What could be improved?"></textarea>
              </div>
            </div>
            
            <div class="form-group">
              <label>Add Photos (optional)</label>
              <div class="photo-upload">
                <input type="file" id="review-photos" multiple accept="image/*" 
                  onchange="reviewSystem.handlePhotoUpload(event)">
                <div class="photo-preview" id="photo-preview"></div>
              </div>
            </div>
            
            <button type="submit" class="btn-primary">
              <i class="fas fa-paper-plane"></i>
              Submit Review
            </button>
          </form>
        </div>
      </div>
    `;

    // Initialize star rating inputs
    this.initStarInputs();
    
    // Character counter
    document.getElementById('review-content')?.addEventListener('input', (e) => {
      document.getElementById('content-chars').textContent = e.target.value.length;
    });
  }

  renderStarInput(field) {
    return `
      <input type="hidden" name="rating-${field}" id="rating-${field}" value="0">
      ${[1, 2, 3, 4, 5].map(star => `
        <i class="far fa-star star-icon" data-value="${star}" 
          onclick="reviewSystem.setRating('${field}', ${star})"
          onmouseover="reviewSystem.hoverRating('${field}', ${star})"
          onmouseout="reviewSystem.resetHover('${field}')"></i>
      `).join('')}
    `;
  }

  initStarInputs() {
    // Already handled inline
  }

  setRating(field, value) {
    document.getElementById(`rating-${field}`).value = value;
    this.updateStars(field, value);
  }

  hoverRating(field, value) {
    const container = document.querySelector(`[data-field="${field}"]`);
    const stars = container.querySelectorAll('.star-icon');
    stars.forEach((star, index) => {
      star.classList.toggle('fas', index < value);
      star.classList.toggle('far', index >= value);
      star.classList.toggle('hovered', index < value);
    });
  }

  resetHover(field) {
    const value = parseInt(document.getElementById(`rating-${field}`).value) || 0;
    this.updateStars(field, value);
  }

  updateStars(field, value) {
    const container = document.querySelector(`[data-field="${field}"]`);
    const stars = container.querySelectorAll('.star-icon');
    stars.forEach((star, index) => {
      star.classList.toggle('fas', index < value);
      star.classList.toggle('far', index >= value);
      star.classList.remove('hovered');
    });
  }

  async loadReviews() {
    const listEl = document.getElementById('reviews-list');
    listEl.innerHTML = '<div class="reviews-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortOrder
      });
      
      if (this.filters.rating) {
        params.append('rating', this.filters.rating);
      }
      if (this.filters.verified) {
        params.append('verified', 'true');
      }

      const response = await fetch(`/api/reviews/dorm/${this.dormId}?${params}`);
      const data = await response.json();
      
      if (data.success) {
        this.reviews = data.data;
        this.renderRatingSummary(data.ratingDistribution);
        this.renderReviews(data.data, data.pagination);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      listEl.innerHTML = '<div class="reviews-error">Failed to load reviews. Please try again.</div>';
    }
  }

  renderRatingSummary(distribution) {
    const summaryEl = document.getElementById('rating-summary');
    const total = distribution.reduce((sum, d) => sum + d.count, 0);
    const avgRating = distribution.reduce((sum, d) => sum + (d._id * d.count), 0) / total || 0;

    summaryEl.innerHTML = `
      <div class="rating-overview">
        <div class="average-rating">
          <span class="rating-number">${avgRating.toFixed(1)}</span>
          <div class="rating-stars">${SEO.renderStarRating(avgRating)}</div>
          <span class="total-reviews">${total} review${total !== 1 ? 's' : ''}</span>
        </div>
        <div class="rating-bars">
          ${[5, 4, 3, 2, 1].map(rating => {
            const count = distribution.find(d => d._id === rating)?.count || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return `
              <div class="rating-bar-row">
                <span class="rating-label">${rating}★</span>
                <div class="rating-bar">
                  <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="rating-count">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderReviews(reviews, pagination) {
    const listEl = document.getElementById('reviews-list');
    
    if (reviews.length === 0) {
      listEl.innerHTML = `
        <div class="reviews-empty">
          <i class="fas fa-comment-slash"></i>
          <p>No reviews yet. Be the first to review this dorm!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = reviews.map(review => this.renderReview(review)).join('');
    this.renderPagination(pagination);
  }

  renderReview(review) {
    const author = review.user;
    const ratings = review.ratings;
    
    return `
      <div class="review-card" data-id="${review._id}">
        <div class="review-header">
          <div class="review-author">
            <img src="${author.profilePicture || '/images/default-avatar.png'}" alt="${author.firstName}">
            <div class="author-info">
              <span class="author-name">
                ${author.firstName} ${author.lastName}
                ${review.isVerified ? '<i class="fas fa-check-circle verified-icon" title="Verified Student"></i>' : ''}
              </span>
              <span class="author-university">${author.university?.name || ''}</span>
            </div>
          </div>
          <div class="review-rating">
            <div class="stars">${SEO.renderStarRating(review.overallRating)}</div>
            <span class="review-date">${SEO.timeAgo(review.createdAt)}</span>
          </div>
        </div>
        
        <h4 class="review-title">${this.escapeHtml(review.title)}</h4>
        
        <div class="review-ratings-breakdown">
          <span title="Cleanliness"><i class="fas fa-broom"></i> ${ratings.cleanliness}</span>
          <span title="Safety"><i class="fas fa-shield-alt"></i> ${ratings.safety}</span>
          <span title="Location"><i class="fas fa-map-marker-alt"></i> ${ratings.location}</span>
          <span title="Landlord"><i class="fas fa-user-tie"></i> ${ratings.landlord}</span>
          <span title="Value"><i class="fas fa-coins"></i> ${ratings.value}</span>
        </div>
        
        <p class="review-content">${this.escapeHtml(review.content)}</p>
        
        ${review.pros?.length || review.cons?.length ? `
          <div class="review-pros-cons">
            ${review.pros?.length ? `
              <div class="pros">
                <h5><i class="fas fa-plus-circle"></i> Pros</h5>
                <ul>${review.pros.map(p => `<li>${this.escapeHtml(p)}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${review.cons?.length ? `
              <div class="cons">
                <h5><i class="fas fa-minus-circle"></i> Cons</h5>
                <ul>${review.cons.map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}</ul>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        ${review.images?.length ? `
          <div class="review-images">
            ${review.images.map(img => `
              <img src="${img.url}" alt="Review photo" onclick="reviewSystem.openLightbox('${img.url}')">
            `).join('')}
          </div>
        ` : ''}
        
        <div class="review-footer">
          <div class="review-votes">
            <button class="vote-btn ${review.userVote === 'upvote' ? 'active' : ''}" 
              onclick="reviewSystem.voteReview('${review._id}', 'upvote')">
              <i class="fas fa-thumbs-up"></i>
              <span>${review.upvoteCount || 0}</span>
            </button>
            <button class="vote-btn ${review.userVote === 'downvote' ? 'active' : ''}" 
              onclick="reviewSystem.voteReview('${review._id}', 'downvote')">
              <i class="fas fa-thumbs-down"></i>
              <span>${review.downvoteCount || 0}</span>
            </button>
          </div>
          <div class="review-actions">
            <button class="action-btn" onclick="reviewSystem.reportReview('${review._id}')">
              <i class="fas fa-flag"></i> Report
            </button>
            <button class="action-btn" onclick="reviewSystem.shareReview('${review._id}')">
              <i class="fas fa-share"></i> Share
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderPagination(pagination) {
    const paginationEl = document.getElementById('reviews-pagination');
    if (!pagination || pagination.pages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '<div class="pagination-buttons">';
    
    if (pagination.current > 1) {
      html += `<button class="page-btn" onclick="reviewSystem.goToPage(${pagination.current - 1})">
        <i class="fas fa-chevron-left"></i>
      </button>`;
    }
    
    for (let i = 1; i <= pagination.pages; i++) {
      if (i === 1 || i === pagination.pages || (i >= pagination.current - 2 && i <= pagination.current + 2)) {
        html += `
          <button class="page-btn ${i === pagination.current ? 'active' : ''}" 
            onclick="reviewSystem.goToPage(${i})">${i}</button>
        `;
      } else if (i === pagination.current - 3 || i === pagination.current + 3) {
        html += '<span class="page-ellipsis">...</span>';
      }
    }
    
    if (pagination.current < pagination.pages) {
      html += `<button class="page-btn" onclick="reviewSystem.goToPage(${pagination.current + 1})">
        <i class="fas fa-chevron-right"></i>
      </button>`;
    }
    
    html += '</div>';
    paginationEl.innerHTML = html;
  }

  filterByRating(rating) {
    this.filters.rating = rating;
    this.currentPage = 1;
    
    // Update active button
    document.querySelectorAll('.rating-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.rating === (rating?.toString() || ''));
    });
    
    this.loadReviews();
  }

  toggleVerifiedFilter() {
    this.filters.verified = document.getElementById('verified-filter').checked;
    this.currentPage = 1;
    this.loadReviews();
  }

  changeSort() {
    const value = document.getElementById('sort-filter').value;
    const [sortBy, sortOrder] = value.split('-');
    this.filters.sortBy = sortBy;
    this.filters.sortOrder = sortOrder;
    this.currentPage = 1;
    this.loadReviews();
  }

  goToPage(page) {
    this.currentPage = page;
    this.loadReviews();
    this.container.scrollIntoView({ behavior: 'smooth' });
  }

  showReviewModal() {
    const modal = document.getElementById('review-modal');
    modal.classList.add('show');
  }

  closeReviewModal() {
    const modal = document.getElementById('review-modal');
    modal.classList.remove('show');
  }

  handlePhotoUpload(event) {
    const files = event.target.files;
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.innerHTML += `
          <div class="photo-item">
            <img src="${e.target.result}" alt="Preview">
            <button type="button" class="remove-photo" onclick="this.parentElement.remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
      };
      reader.readAsDataURL(file);
    }
  }

  async submitReview(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append('dormId', this.dormId);
    formData.append('title', document.getElementById('review-title').value);
    formData.append('content', document.getElementById('review-content').value);
    formData.append('overallRating', document.getElementById('rating-overall').value);
    
    formData.append('ratings[cleanliness]', document.getElementById('rating-cleanliness').value || 3);
    formData.append('ratings[safety]', document.getElementById('rating-safety').value || 3);
    formData.append('ratings[location]', document.getElementById('rating-location').value || 3);
    formData.append('ratings[landlord]', document.getElementById('rating-landlord').value || 3);
    formData.append('ratings[value]', document.getElementById('rating-value').value || 3);
    
    // Parse pros and cons
    const pros = document.getElementById('review-pros').value.split('\n').filter(p => p.trim());
    const cons = document.getElementById('review-cons').value.split('\n').filter(c => c.trim());
    formData.append('pros', JSON.stringify(pros));
    formData.append('cons', JSON.stringify(cons));
    
    // Add photos
    const photoInput = document.getElementById('review-photos');
    for (const file of photoInput.files) {
      formData.append('images', file);
    }

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        this.closeReviewModal();
        document.getElementById('review-form').reset();
        document.getElementById('photo-preview').innerHTML = '';
        await this.loadReviews();
        
        // Show badge notification if earned
        if (data.newBadges?.length) {
          this.showBadgeNotification(data.newBadges);
        }
        
        this.showNotification('Review submitted successfully!', 'success');
      } else {
        this.showNotification(data.message || 'Failed to submit review', 'error');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      this.showNotification('Failed to submit review. Please try again.', 'error');
    }
  }

  async voteReview(reviewId, voteType) {
    try {
      const response = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ voteType })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update UI
        const reviewCard = document.querySelector(`[data-id="${reviewId}"]`);
        const upvoteBtn = reviewCard.querySelector('.vote-btn:first-child span');
        const downvoteBtn = reviewCard.querySelector('.vote-btn:last-child span');
        
        upvoteBtn.textContent = data.data.upvoteCount;
        downvoteBtn.textContent = data.data.downvoteCount;
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  async reportReview(reviewId) {
    const reason = prompt('Why are you reporting this review?\n\n1. Inappropriate content\n2. Fake review\n3. Spam\n4. Harassment\n5. Other\n\nEnter number or description:');
    
    if (!reason) return;

    try {
      const response = await fetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ reason, description: reason })
      });

      const data = await response.json();
      
      if (data.success) {
        this.showNotification('Review reported. Thank you for helping keep our community safe.', 'success');
      } else {
        this.showNotification(data.message, 'error');
      }
    } catch (error) {
      console.error('Error reporting:', error);
    }
  }

  shareReview(reviewId) {
    const url = `${window.location.origin}/review/${reviewId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Check out this review on RoastMyDorm',
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      this.showNotification('Link copied to clipboard!', 'success');
    }
  }

  openLightbox(imageUrl) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <div class="lightbox-content">
        <img src="${imageUrl}" alt="Review photo">
        <button class="lightbox-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    document.body.appendChild(lightbox);
  }

  showBadgeNotification(badges) {
    badges.forEach((badge, index) => {
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.className = 'badge-notification';
        notification.innerHTML = `
          <div class="badge-icon">${badge.icon}</div>
          <div class="badge-info">
            <strong>Badge Earned!</strong>
            <span>${badge.name}</span>
          </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
      }, index * 1000);
    });
  }

  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  showNotification(message, type = 'info') {
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

// CSS styles for review component
const reviewStyles = `
  .reviews-section {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin: 24px 0;
  }

  .reviews-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .reviews-title {
    font-size: 1.5rem;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .write-review-btn {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .write-review-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .rating-summary {
    margin-bottom: 24px;
  }

  .rating-overview {
    display: flex;
    gap: 40px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .average-rating {
    text-align: center;
  }

  .rating-number {
    font-size: 3rem;
    font-weight: 700;
    color: #1f2937;
    display: block;
  }

  .rating-stars {
    color: #f59e0b;
    font-size: 1.25rem;
    margin: 8px 0;
  }

  .total-reviews {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .rating-bars {
    flex: 1;
    max-width: 400px;
  }

  .rating-bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .rating-label {
    width: 30px;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .rating-bar {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .rating-bar-fill {
    height: 100%;
    background: #f59e0b;
    border-radius: 4px;
    transition: width 0.3s;
  }

  .rating-count {
    width: 30px;
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
  }

  .reviews-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    margin-bottom: 24px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rating-filter-buttons {
    display: flex;
    gap: 4px;
  }

  .rating-filter-btn {
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .rating-filter-btn.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .review-card {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    transition: box-shadow 0.2s;
  }

  .review-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .review-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .review-author img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-weight: 600;
    color: #1f2937;
  }

  .verified-icon {
    color: #3b82f6;
    margin-left: 4px;
  }

  .author-university {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .review-rating {
    text-align: right;
  }

  .review-date {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .review-title {
    font-size: 1.125rem;
    color: #1f2937;
    margin-bottom: 8px;
  }

  .review-ratings-breakdown {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .review-ratings-breakdown span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .review-content {
    color: #374151;
    line-height: 1.6;
    margin-bottom: 16px;
  }

  .review-pros-cons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .pros h5 { color: #059669; }
  .cons h5 { color: #dc2626; }

  .pros ul, .cons ul {
    margin: 8px 0 0 20px;
    padding: 0;
  }

  .pros li, .cons li {
    margin-bottom: 4px;
  }

  .review-images {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .review-images img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .review-images img:hover {
    transform: scale(1.05);
  }

  .review-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  .review-votes {
    display: flex;
    gap: 12px;
  }

  .review-votes .vote-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
  }

  .review-votes .vote-btn:hover {
    background: #f3f4f6;
  }

  .review-votes .vote-btn.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .review-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 6px 12px;
    font-size: 0.875rem;
  }

  .action-btn:hover {
    color: #374151;
  }

  .review-modal-content {
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .rating-inputs {
    margin-bottom: 20px;
  }

  .rating-input-group {
    margin-bottom: 12px;
  }

  .rating-input-group label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    color: #374151;
  }

  .star-input {
    display: flex;
    gap: 4px;
  }

  .star-icon {
    font-size: 1.5rem;
    color: #d1d5db;
    cursor: pointer;
    transition: color 0.2s;
  }

  .star-icon.fas, .star-icon.hovered {
    color: #f59e0b;
  }

  .rating-categories {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .rating-categories .star-icon {
    font-size: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .char-count {
    display: block;
    text-align: right;
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 4px;
  }

  .photo-upload {
    border: 2px dashed #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .photo-preview {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .photo-item {
    position: relative;
  }

  .photo-item img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 8px;
  }

  .remove-photo {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .lightbox {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1100;
  }

  .lightbox-content {
    position: relative;
    max-width: 90%;
    max-height: 90%;
  }

  .lightbox-content img {
    max-width: 100%;
    max-height: 90vh;
    border-radius: 8px;
  }

  .lightbox-close {
    position: absolute;
    top: -40px;
    right: 0;
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
  }

  .badge-notification {
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    animation: slideIn 0.5s ease, pulse 2s ease-in-out infinite;
    z-index: 1100;
  }

  .badge-icon {
    font-size: 2rem;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  @media (max-width: 640px) {
    .reviews-header {
      flex-direction: column;
      gap: 16px;
    }
    
    .rating-overview {
      flex-direction: column;
    }
    
    .reviews-filters {
      flex-direction: column;
      align-items: stretch;
    }
    
    .rating-filter-buttons {
      flex-wrap: wrap;
    }
    
    .review-pros-cons {
      grid-template-columns: 1fr;
    }
    
    .form-row {
      grid-template-columns: 1fr;
    }
  }
`;

// Inject styles
const reviewStyleSheet = document.createElement('style');
reviewStyleSheet.textContent = reviewStyles;
document.head.appendChild(reviewStyleSheet);

// Export for use
window.ReviewSystem = ReviewSystem;
