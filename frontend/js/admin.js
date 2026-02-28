/**
 * RoastMyDorm Admin Dashboard JavaScript
 * Handles all admin dashboard functionality including:
 * - Authentication & session management
 * - Data fetching & display
 * - Charts & analytics
 * - CRUD operations
 * - Modals & notifications
 */

// ============================================
// Configuration
// ============================================

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : 'https://roastmydorm-backend-zy4p.vercel.app/api';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ============================================
// State Management
// ============================================

const state = {
  user: null,
  accessToken: null,
  refreshToken: null,
  currentPage: 'dashboard',
  charts: {},
  pagination: {
    users: { page: 1, limit: 20, total: 0 },
    dorms: { page: 1, limit: 20, total: 0 },
    reviews: { page: 1, limit: 20, total: 0 },
    roommates: { page: 1, limit: 20, total: 0 },
    reports: { page: 1, limit: 20, total: 0 }
  },
  filters: {
    users: {},
    dorms: {},
    reviews: {},
    roommates: {},
    reports: { status: 'pending' }
  },
  selectedItems: {
    users: [],
    dorms: [],
    reviews: []
  }
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // Check for stored auth
  const storedToken = localStorage.getItem('adminAccessToken');
  const storedUser = localStorage.getItem('adminUser');
  
  if (storedToken && storedUser) {
    state.accessToken = storedToken;
    state.refreshToken = localStorage.getItem('adminRefreshToken');
    state.user = JSON.parse(storedUser);
    
    // Verify token is still valid
    const isValid = await verifyToken();
    if (isValid) {
      showAdminApp();
      return;
    }
  }
  
  showLoginScreen();
}

// ============================================
// Authentication
// ============================================

async function verifyToken() {
  try {
    const response = await apiRequest('/admin/dashboard', 'GET');
    return response.success;
  } catch (error) {
    return false;
  }
}

function showLoginScreen() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('admin-app').classList.add('hidden');
  
  // Setup login form
  document.getElementById('admin-login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
  errorEl.textContent = '';
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    // Check if response has content
    const text = await response.text();
    if (!text) {
      throw new Error('Server returned empty response. Is the backend running?');
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid response from server. Check if backend is running on port 5000.');
    }
    
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Check if user is admin
    if (data.data.user.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.');
    }
    
    // Store auth data
    state.accessToken = data.data.accessToken;
    state.refreshToken = data.data.refreshToken;
    state.user = data.data.user;
    
    localStorage.setItem('adminAccessToken', state.accessToken);
    localStorage.setItem('adminRefreshToken', state.refreshToken);
    localStorage.setItem('adminUser', JSON.stringify(state.user));
    
    showAdminApp();
    
  } catch (error) {
    // Better error messages for common issues
    let errorMessage = error.message;
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Cannot connect to server. Make sure the backend is running.';
    }
    errorEl.textContent = errorMessage;
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
  }
}

function logout() {
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  
  localStorage.removeItem('adminAccessToken');
  localStorage.removeItem('adminRefreshToken');
  localStorage.removeItem('adminUser');
  
  showLoginScreen();
}

// ============================================
// App Initialization
// ============================================

function showAdminApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  
  // Update admin profile
  updateAdminProfile();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load dashboard data
  loadDashboard();
  
  // Setup auto-refresh
  setInterval(refreshCurrentPage, REFRESH_INTERVAL);
}

function updateAdminProfile() {
  const nameEl = document.getElementById('admin-name');
  const avatarEl = document.getElementById('admin-avatar');
  
  const name = `${state.user.firstName || ''} ${state.user.lastName || ''}`.trim() || 'Admin';
  nameEl.textContent = name;
  
  if (state.user.profilePicture) {
    avatarEl.innerHTML = `<img src="${state.user.profilePicture}" alt="${name}">`;
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateToPage(page);
    });
  });
  
  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  
  // Mobile menu
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', refreshCurrentPage);
  
  // Analytics tabs
  document.querySelectorAll('.analytics-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAnalyticsTab(btn.dataset.tab));
  });
  
  // Settings tabs
  document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
  });
  
  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });
  
  // Close modal on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });
  });
  
  // Chart period selects
  document.getElementById('growth-period')?.addEventListener('change', (e) => {
    loadUserGrowthChart(parseInt(e.target.value));
  });
  
  document.getElementById('reviews-period')?.addEventListener('change', (e) => {
    loadReviewsChart(parseInt(e.target.value));
  });
  
  // Users page filters
  setupUsersPageListeners();
  setupDormsPageListeners();
  setupReviewsPageListeners();
  setupRoommatesPageListeners();
  setupReportsPageListeners();
  setupSettingsPageListeners();
}

// ============================================
// Navigation
// ============================================

function navigateToPage(page) {
  state.currentPage = page;
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  // Update page visibility
  document.querySelectorAll('.page').forEach(pageEl => {
    pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
  });
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    users: 'User Management',
    dorms: 'Dorm Management',
    reviews: 'Review Moderation',
    roommates: 'Roommate Profiles',
    analytics: 'Analytics',
    reports: 'Reports & Moderation',
    settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
  
  // Close mobile menu
  document.getElementById('sidebar').classList.remove('mobile-open');
  
  // Load page data
  loadPageData(page);
}

function loadPageData(page) {
  switch (page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'dorms':
      loadDorms();
      break;
    case 'reviews':
      loadReviews();
      break;
    case 'roommates':
      loadRoommates();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'reports':
      loadReports();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

function refreshCurrentPage() {
  loadPageData(state.currentPage);
}

// ============================================
// API Helper
// ============================================

async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.accessToken}`
  };
  
  const options = { method, headers };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (response.status === 401) {
    // Token expired, try refresh
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      return apiRequest(endpoint, method, body);
    } else {
      logout();
      throw new Error('Session expired');
    }
  }
  
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  
  return data;
}

async function refreshAuthToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      state.accessToken = data.data.accessToken;
      localStorage.setItem('adminAccessToken', state.accessToken);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// ============================================
// Dashboard
// ============================================

async function loadDashboard() {
  try {
    const data = await apiRequest('/admin/dashboard');
    
    if (data.success) {
      updateDashboardStats(data.data);
      updateRecentActivity(data.data);
      loadUserGrowthChart(30);
      loadReviewsChart(30);
      updateReportsBadge();
    }
  } catch (error) {
    showToast('Failed to load dashboard', 'error');
  }
}

function updateDashboardStats(data) {
  const { overview } = data;
  
  document.getElementById('stat-total-users').textContent = formatNumber(overview.totalUsers);
  document.getElementById('stat-total-dorms').textContent = formatNumber(overview.totalDorms);
  document.getElementById('stat-total-reviews').textContent = formatNumber(overview.totalReviews);
  document.getElementById('stat-pending-reports').textContent = formatNumber(overview.pendingReports);
  
  // Update changes
  const usersChange = document.getElementById('stat-users-change');
  usersChange.innerHTML = `<i class="fas fa-arrow-${overview.userGrowthRate >= 0 ? 'up' : 'down'}"></i><span>${overview.userGrowthRate}%</span>`;
  usersChange.className = `stat-change ${overview.userGrowthRate >= 0 ? 'positive' : 'negative'}`;
  
  document.getElementById('stat-reviews-change').innerHTML = `<i class="fas fa-arrow-up"></i><span>+${overview.reviewsThisWeek} this week</span>`;
  document.getElementById('stat-pending-dorms').innerHTML = `<span>${overview.pendingDorms} pending</span>`;
  
  // Update urgent badge visibility
  const urgentBadge = document.getElementById('stat-reports-urgent');
  urgentBadge.style.display = overview.pendingReports > 0 ? 'block' : 'none';
}

function updateRecentActivity(data) {
  // Recent signups
  const signupsEl = document.getElementById('recent-signups');
  if (data.recentActivity.signups.length > 0) {
    signupsEl.innerHTML = data.recentActivity.signups.map(user => `
      <div class="activity-item">
        <div class="avatar">
          ${user.profilePicture 
            ? `<img src="${user.profilePicture}" alt="${user.firstName}">` 
            : (user.firstName?.charAt(0) || 'U')}
        </div>
        <div class="activity-item-info">
          <div class="activity-item-name">${user.firstName} ${user.lastName || ''}</div>
          <div class="activity-item-meta">${user.university?.name || 'No university'}</div>
        </div>
        <span class="activity-item-badge ${user.isVerified ? 'status-badge verified' : ''}">${user.isVerified ? 'Verified' : ''}</span>
      </div>
    `).join('');
  } else {
    signupsEl.innerHTML = '<div class="loading-placeholder">No recent signups</div>';
  }
  
  // Recent reviews
  const reviewsEl = document.getElementById('recent-reviews');
  if (data.recentActivity.reviews.length > 0) {
    reviewsEl.innerHTML = data.recentActivity.reviews.map(review => `
      <div class="activity-item">
        <div class="avatar">
          ${review.user?.profilePicture 
            ? `<img src="${review.user.profilePicture}" alt="${review.user.firstName}">` 
            : (review.user?.firstName?.charAt(0) || 'U')}
        </div>
        <div class="activity-item-info">
          <div class="activity-item-name">${review.dorm?.name || 'Unknown Dorm'}</div>
          <div class="activity-item-meta">by ${review.user?.firstName || 'Anonymous'}</div>
        </div>
        <span class="activity-item-badge">${'★'.repeat(Math.round(review.overallRating))}</span>
      </div>
    `).join('');
  } else {
    reviewsEl.innerHTML = '<div class="loading-placeholder">No recent reviews</div>';
  }
  
  // Top dorms
  const dormsEl = document.getElementById('top-dorms');
  if (data.topDorms.length > 0) {
    dormsEl.innerHTML = data.topDorms.map((dorm, index) => `
      <div class="activity-item">
        <div class="avatar" style="background: var(--success)">${index + 1}</div>
        <div class="activity-item-info">
          <div class="activity-item-name">${dorm.name}</div>
          <div class="activity-item-meta">${dorm.location?.address?.city || 'Unknown'}</div>
        </div>
        <span class="activity-item-badge">${dorm.reviewCount} reviews</span>
      </div>
    `).join('');
  } else {
    dormsEl.innerHTML = '<div class="loading-placeholder">No dorm data</div>';
  }
}

async function loadUserGrowthChart(days) {
  try {
    const data = await apiRequest(`/admin/analytics/growth?period=${days}d&metric=users`);
    
    if (data.success) {
      renderLineChart('user-growth-chart', data.data.values, 'New Users', '#6366f1');
    }
  } catch (error) {
    console.error('Failed to load user growth chart:', error);
  }
}

async function loadReviewsChart(days) {
  try {
    const data = await apiRequest(`/admin/analytics/growth?period=${days}d&metric=reviews`);
    
    if (data.success) {
      renderLineChart('reviews-chart', data.data.values, 'Reviews', '#f59e0b');
    }
  } catch (error) {
    console.error('Failed to load reviews chart:', error);
  }
}

// ============================================
// Chart Rendering
// ============================================

function renderLineChart(canvasId, data, label, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  // Destroy existing chart
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
  }
  
  state.charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => formatShortDate(d.date)),
      datasets: [{
        label: label,
        data: data.map(d => d.count),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' }
        }
      }
    }
  });
}

function renderDoughnutChart(canvasId, labels, data, colors) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
  }
  
  state.charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 20 }
        }
      }
    }
  });
}

function renderBarChart(canvasId, labels, data, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
  }
  
  state.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: color,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

// ============================================
// Users Page
// ============================================

function setupUsersPageListeners() {
  // Search
  document.getElementById('users-search')?.addEventListener('input', debounce((e) => {
    state.filters.users.search = e.target.value;
    state.pagination.users.page = 1;
    loadUsers();
  }, 300));
  
  // Type filter
  document.getElementById('users-type-filter')?.addEventListener('change', (e) => {
    state.filters.users.userType = e.target.value;
    state.pagination.users.page = 1;
    loadUsers();
  });
  
  // Status filter
  document.getElementById('users-status-filter')?.addEventListener('change', (e) => {
    state.filters.users.status = e.target.value;
    state.pagination.users.page = 1;
    loadUsers();
  });
  
  // Pagination
  document.getElementById('users-prev')?.addEventListener('click', () => {
    if (state.pagination.users.page > 1) {
      state.pagination.users.page--;
      loadUsers();
    }
  });
  
  document.getElementById('users-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.pagination.users.total / state.pagination.users.limit);
    if (state.pagination.users.page < totalPages) {
      state.pagination.users.page++;
      loadUsers();
    }
  });
  
  // Select all
  document.getElementById('select-all-users')?.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('#users-table-body input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    updateSelectedUsers();
  });
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="8"><div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading users...</span></div></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      page: state.pagination.users.page,
      limit: state.pagination.users.limit,
      ...state.filters.users
    });
    
    const data = await apiRequest(`/admin/users?${params}`);
    
    if (data.success) {
      state.pagination.users.total = data.data.pagination.total;
      renderUsersTable(data.data.users);
      updateUsersPagination(data.data.pagination);
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">Failed to load users</div></td></tr>`;
    showToast('Failed to load users', 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">No users found</div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr data-id="${user._id}">
      <td><input type="checkbox" value="${user._id}" onchange="updateSelectedUsers()"></td>
      <td>
        <div class="user-cell">
          <div class="avatar">
            ${user.profilePicture 
              ? `<img src="${user.profilePicture}" alt="${user.firstName}">` 
              : (user.firstName?.charAt(0) || 'U')}
          </div>
          <span>${user.firstName || ''} ${user.lastName || ''}</span>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="status-badge">${user.userType}</span></td>
      <td>${user.university?.name || '-'}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <span class="status-badge ${getUserStatusClass(user)}">
          ${getUserStatus(user)}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="viewUser('${user._id}')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon success" onclick="verifyUser('${user._id}')" title="Verify">
          <i class="fas fa-check"></i>
        </button>
        <button class="btn-icon danger" onclick="confirmAction('ban', 'user', '${user._id}')" title="Ban">
          <i class="fas fa-ban"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function getUserStatus(user) {
  if (user.isBanned) return 'Banned';
  if (!user.isActive) return 'Inactive';
  if (user.isVerified) return 'Verified';
  return 'Active';
}

function getUserStatusClass(user) {
  if (user.isBanned) return 'banned';
  if (!user.isActive) return 'inactive';
  if (user.isVerified) return 'verified';
  return 'active';
}

function updateUsersPagination(pagination) {
  document.getElementById('users-current-page').textContent = pagination.current;
  document.getElementById('users-total-pages').textContent = pagination.pages;
  document.getElementById('users-prev').disabled = pagination.current <= 1;
  document.getElementById('users-next').disabled = pagination.current >= pagination.pages;
}

async function viewUser(id) {
  try {
    const data = await apiRequest(`/admin/users/${id}`);
    
    if (data.success) {
      const user = data.data;
      const modalBody = document.getElementById('user-modal-body');
      
      modalBody.innerHTML = `
        <div class="modal-user-header">
          <div class="avatar" style="width: 64px; height: 64px; font-size: 24px;">
            ${user.profilePicture 
              ? `<img src="${user.profilePicture}" alt="${user.firstName}" style="width: 100%; height: 100%; border-radius: 50%;">` 
              : (user.firstName?.charAt(0) || 'U')}
          </div>
          <div>
            <h3>${user.firstName || ''} ${user.lastName || ''}</h3>
            <p>${user.email}</p>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <p><strong>Type:</strong> ${user.userType}</p>
          <p><strong>University:</strong> ${user.university?.name || '-'}</p>
          <p><strong>Joined:</strong> ${formatDate(user.createdAt)}</p>
          <p><strong>Last Login:</strong> ${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</p>
          <p><strong>Reviews:</strong> ${user.reviewCount || 0}</p>
          <p><strong>Status:</strong> <span class="status-badge ${getUserStatusClass(user)}">${getUserStatus(user)}</span></p>
        </div>
      `;
      
      // Update modal buttons
      document.getElementById('user-ban-btn').onclick = () => confirmAction('ban', 'user', id);
      
      openModal('user-modal');
    }
  } catch (error) {
    showToast('Failed to load user details', 'error');
  }
}

async function verifyUser(id) {
  try {
    await apiRequest(`/admin/users/${id}/verify`, 'POST');
    showToast('User verified successfully', 'success');
    loadUsers();
  } catch (error) {
    showToast('Failed to verify user', 'error');
  }
}

async function banUser(id, reason) {
  try {
    await apiRequest(`/admin/users/${id}/ban`, 'POST', { reason });
    showToast('User banned successfully', 'success');
    loadUsers();
    closeAllModals();
  } catch (error) {
    showToast('Failed to ban user', 'error');
  }
}

// ============================================
// Dorms Page (Similar pattern)
// ============================================

function setupDormsPageListeners() {
  document.getElementById('dorms-search')?.addEventListener('input', debounce((e) => {
    state.filters.dorms.search = e.target.value;
    state.pagination.dorms.page = 1;
    loadDorms();
  }, 300));
  
  document.getElementById('dorms-city-filter')?.addEventListener('change', (e) => {
    state.filters.dorms.city = e.target.value;
    state.pagination.dorms.page = 1;
    loadDorms();
  });
  
  document.getElementById('dorms-status-filter')?.addEventListener('change', (e) => {
    state.filters.dorms.status = e.target.value;
    state.pagination.dorms.page = 1;
    loadDorms();
  });
  
  document.getElementById('dorms-prev')?.addEventListener('click', () => {
    if (state.pagination.dorms.page > 1) {
      state.pagination.dorms.page--;
      loadDorms();
    }
  });
  
  document.getElementById('dorms-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.pagination.dorms.total / state.pagination.dorms.limit);
    if (state.pagination.dorms.page < totalPages) {
      state.pagination.dorms.page++;
      loadDorms();
    }
  });
}

async function loadDorms() {
  const tbody = document.getElementById('dorms-table-body');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="8"><div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading dorms...</span></div></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      page: state.pagination.dorms.page,
      limit: state.pagination.dorms.limit,
      ...state.filters.dorms
    });
    
    const data = await apiRequest(`/admin/dorms?${params}`);
    
    if (data.success) {
      state.pagination.dorms.total = data.data.pagination.total;
      renderDormsTable(data.data.dorms);
      updateDormsPagination(data.data.pagination);
      
      // Check for pending dorms
      const pendingCount = data.data.dorms.filter(d => d.status === 'pending').length;
      const alertEl = document.getElementById('pending-dorms-alert');
      if (pendingCount > 0) {
        document.getElementById('pending-count').textContent = pendingCount;
        alertEl.style.display = 'flex';
      } else {
        alertEl.style.display = 'none';
      }
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">Failed to load dorms</div></td></tr>`;
    showToast('Failed to load dorms', 'error');
  }
}

function renderDormsTable(dorms) {
  const tbody = document.getElementById('dorms-table-body');
  
  if (dorms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">No dorms found</div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = dorms.map(dorm => `
    <tr data-id="${dorm._id}">
      <td><input type="checkbox" value="${dorm._id}"></td>
      <td>${dorm.name}</td>
      <td>${dorm.location?.address?.city || '-'}</td>
      <td>${dorm.pricing?.baseRent ? formatCurrency(dorm.pricing.baseRent) : '-'}</td>
      <td>${dorm.averageRating ? `${dorm.averageRating.toFixed(1)} ★` : '-'}</td>
      <td>${dorm.reviewCount || 0}</td>
      <td><span class="status-badge ${dorm.status}">${dorm.status}</span></td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="viewDorm('${dorm._id}')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        ${dorm.status === 'pending' ? `
          <button class="btn-icon success" onclick="approveDorm('${dorm._id}')" title="Approve">
            <i class="fas fa-check"></i>
          </button>
          <button class="btn-icon danger" onclick="confirmAction('reject', 'dorm', '${dorm._id}')" title="Reject">
            <i class="fas fa-times"></i>
          </button>
        ` : `
          <button class="btn-icon danger" onclick="confirmAction('delete', 'dorm', '${dorm._id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        `}
      </td>
    </tr>
  `).join('');
}

function updateDormsPagination(pagination) {
  document.getElementById('dorms-current-page').textContent = pagination.current;
  document.getElementById('dorms-total-pages').textContent = pagination.pages;
  document.getElementById('dorms-prev').disabled = pagination.current <= 1;
  document.getElementById('dorms-next').disabled = pagination.current >= pagination.pages;
}

async function approveDorm(id) {
  try {
    await apiRequest(`/admin/dorms/${id}/approve`, 'POST');
    showToast('Dorm approved successfully', 'success');
    loadDorms();
  } catch (error) {
    showToast('Failed to approve dorm', 'error');
  }
}

// ============================================
// Reviews Page
// ============================================

function setupReviewsPageListeners() {
  document.getElementById('reviews-search')?.addEventListener('input', debounce((e) => {
    state.filters.reviews.search = e.target.value;
    state.pagination.reviews.page = 1;
    loadReviews();
  }, 300));
  
  document.getElementById('reviews-status-filter')?.addEventListener('change', (e) => {
    state.filters.reviews.status = e.target.value;
    state.pagination.reviews.page = 1;
    loadReviews();
  });
  
  document.getElementById('reviews-rating-filter')?.addEventListener('change', (e) => {
    state.filters.reviews.minRating = e.target.value;
    state.filters.reviews.maxRating = e.target.value;
    state.pagination.reviews.page = 1;
    loadReviews();
  });
  
  document.getElementById('reviews-prev')?.addEventListener('click', () => {
    if (state.pagination.reviews.page > 1) {
      state.pagination.reviews.page--;
      loadReviews();
    }
  });
  
  document.getElementById('reviews-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.pagination.reviews.total / state.pagination.reviews.limit);
    if (state.pagination.reviews.page < totalPages) {
      state.pagination.reviews.page++;
      loadReviews();
    }
  });
}

async function loadReviews() {
  const tbody = document.getElementById('reviews-table-body');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="8"><div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading reviews...</span></div></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      page: state.pagination.reviews.page,
      limit: state.pagination.reviews.limit,
      ...state.filters.reviews
    });
    
    const data = await apiRequest(`/admin/reviews?${params}`);
    
    if (data.success) {
      state.pagination.reviews.total = data.data.pagination.total;
      renderReviewsTable(data.data.reviews);
      updateReviewsPagination(data.data.pagination);
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">Failed to load reviews</div></td></tr>`;
    showToast('Failed to load reviews', 'error');
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviews-table-body');
  
  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-placeholder">No reviews found</div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = reviews.map(review => `
    <tr data-id="${review._id}">
      <td><input type="checkbox" value="${review._id}"></td>
      <td>
        <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${review.title || review.pros?.substring(0, 50) || 'No title'}
        </div>
      </td>
      <td>${review.dorm?.name || 'Unknown'}</td>
      <td>${'★'.repeat(Math.round(review.overallRating))}</td>
      <td>${review.user?.firstName || 'Anonymous'}</td>
      <td>${formatDate(review.createdAt)}</td>
      <td>
        <span class="status-badge ${review.isFlagged ? 'flagged' : review.isVerified ? 'verified' : 'active'}">
          ${review.isFlagged ? 'Flagged' : review.isVerified ? 'Verified' : 'Active'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="viewReview('${review._id}')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon success" onclick="approveReview('${review._id}')" title="Approve">
          <i class="fas fa-check"></i>
        </button>
        <button class="btn-icon danger" onclick="confirmAction('delete', 'review', '${review._id}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateReviewsPagination(pagination) {
  document.getElementById('reviews-current-page').textContent = pagination.current;
  document.getElementById('reviews-total-pages').textContent = pagination.pages;
  document.getElementById('reviews-prev').disabled = pagination.current <= 1;
  document.getElementById('reviews-next').disabled = pagination.current >= pagination.pages;
}

async function approveReview(id) {
  try {
    await apiRequest(`/admin/reviews/${id}/approve`, 'POST');
    showToast('Review approved successfully', 'success');
    loadReviews();
  } catch (error) {
    showToast('Failed to approve review', 'error');
  }
}

// ============================================
// Roommates Page
// ============================================

function setupRoommatesPageListeners() {
  document.getElementById('roommates-search')?.addEventListener('input', debounce((e) => {
    state.filters.roommates.search = e.target.value;
    state.pagination.roommates.page = 1;
    loadRoommates();
  }, 300));
  
  document.getElementById('roommates-city-filter')?.addEventListener('change', (e) => {
    state.filters.roommates.city = e.target.value;
    state.pagination.roommates.page = 1;
    loadRoommates();
  });
}

async function loadRoommates() {
  const tbody = document.getElementById('roommates-table-body');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading profiles...</span></div></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      page: state.pagination.roommates.page,
      limit: state.pagination.roommates.limit,
      ...state.filters.roommates
    });
    
    const data = await apiRequest(`/admin/roommates?${params}`);
    
    if (data.success) {
      state.pagination.roommates.total = data.data.pagination.total;
      renderRoommatesTable(data.data.profiles);
      updateRoommatesPagination(data.data.pagination);
      
      // Update stats
      const stats = await apiRequest('/admin/roommates/stats');
      if (stats.success) {
        document.getElementById('roommates-total').textContent = stats.data.total;
        document.getElementById('roommates-active').textContent = stats.data.active;
        document.getElementById('roommates-matches').textContent = stats.data.totalMatches;
      }
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-placeholder">Failed to load profiles</div></td></tr>`;
    showToast('Failed to load roommate profiles', 'error');
  }
}

function renderRoommatesTable(profiles) {
  const tbody = document.getElementById('roommates-table-body');
  
  if (profiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="loading-placeholder">No profiles found</div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = profiles.map(profile => `
    <tr data-id="${profile._id}">
      <td>
        <div class="user-cell">
          <div class="avatar">
            ${profile.user?.firstName?.charAt(0) || 'U'}
          </div>
          <span>${profile.user?.firstName || ''} ${profile.user?.lastName || ''}</span>
        </div>
      </td>
      <td>${profile.preferredCities?.join(', ') || '-'}</td>
      <td>${profile.user?.university?.name || '-'}</td>
      <td>${profile.budget?.max ? formatCurrency(profile.budget.max) : '-'}</td>
      <td>${profile.matchCount || 0}</td>
      <td>
        <span class="status-badge ${profile.isActive ? 'active' : 'inactive'}">
          ${profile.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="viewRoommateProfile('${profile._id}')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon danger" onclick="confirmAction('delete', 'roommate', '${profile._id}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateRoommatesPagination(pagination) {
  document.getElementById('roommates-current-page').textContent = pagination.current;
  document.getElementById('roommates-total-pages').textContent = pagination.pages;
  document.getElementById('roommates-prev').disabled = pagination.current <= 1;
  document.getElementById('roommates-next').disabled = pagination.current >= pagination.pages;
}

// ============================================
// Analytics Page
// ============================================

async function loadAnalytics() {
  await loadAnalyticsOverview();
}

async function loadAnalyticsOverview() {
  try {
    const [overviewData, retentionData] = await Promise.all([
      apiRequest('/admin/analytics/overview?period=30d'),
      apiRequest('/admin/analytics/retention')
    ]);
    
    if (overviewData.success) {
      const metrics = overviewData.data.metrics;
      document.getElementById('analytics-pageviews').textContent = formatNumber(metrics.pageViews.value);
      document.getElementById('analytics-visitors').textContent = formatNumber(metrics.uniqueVisitors.value);
      document.getElementById('analytics-new-users').textContent = formatNumber(metrics.newUsers.value);
      
      if (metrics.pageViews.change) {
        document.getElementById('analytics-pageviews-change').textContent = `${metrics.pageViews.change > 0 ? '+' : ''}${metrics.pageViews.change}%`;
      }
      if (metrics.newUsers.change) {
        document.getElementById('analytics-users-change').textContent = `${metrics.newUsers.change > 0 ? '+' : ''}${metrics.newUsers.change}%`;
      }
    }
    
    if (retentionData.success) {
      document.getElementById('analytics-retention').textContent = `${retentionData.data.retentionRate}%`;
    }
    
    // Load traffic chart
    const trafficData = await apiRequest('/admin/analytics/growth?period=30d&metric=pageViews');
    if (trafficData.success) {
      renderLineChart('traffic-chart', trafficData.data.values, 'Page Views', '#3b82f6');
    }
  } catch (error) {
    console.error('Failed to load analytics overview:', error);
  }
}

function switchAnalyticsTab(tab) {
  document.querySelectorAll('.analytics-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tab}-tab`);
  });
  
  // Load tab-specific data
  switch (tab) {
    case 'traffic':
      loadTrafficAnalytics();
      break;
    case 'engagement':
      loadEngagementAnalytics();
      break;
    case 'market':
      loadMarketAnalytics();
      break;
  }
}

async function loadTrafficAnalytics() {
  try {
    const data = await apiRequest('/admin/analytics/traffic?period=30d');
    
    if (data.success) {
      // Render top pages
      const topPagesEl = document.getElementById('top-pages-list');
      if (data.data.topPages.length > 0) {
        topPagesEl.innerHTML = data.data.topPages.map((page, i) => `
          <div class="top-list-item">
            <span class="rank">${i + 1}</span>
            <div class="info">
              <div class="name">${page._id || 'Unknown'}</div>
            </div>
            <span class="value">${formatNumber(page.views)}</span>
          </div>
        `).join('');
      }
      
      // Render device breakdown
      if (data.data.deviceBreakdown.length > 0) {
        const labels = data.data.deviceBreakdown.map(d => d._id);
        const values = data.data.deviceBreakdown.map(d => d.count);
        renderDoughnutChart('device-chart', labels, values, ['#6366f1', '#10b981', '#f59e0b', '#ef4444']);
      }
      
      // Render traffic sources
      const sourcesEl = document.getElementById('traffic-sources-list');
      if (data.data.trafficSources.length > 0) {
        sourcesEl.innerHTML = data.data.trafficSources.map((source, i) => `
          <div class="top-list-item">
            <span class="rank">${i + 1}</span>
            <div class="info">
              <div class="name">${source._id.source}</div>
              <div class="meta">${source._id.medium || 'Direct'}</div>
            </div>
            <span class="value">${formatNumber(source.count)}</span>
          </div>
        `).join('');
      }
      
      // Render top cities
      const citiesEl = document.getElementById('top-cities-list');
      if (data.data.topCities.length > 0) {
        citiesEl.innerHTML = data.data.topCities.map((city, i) => `
          <div class="top-list-item">
            <span class="rank">${i + 1}</span>
            <div class="info">
              <div class="name">${city._id || 'Unknown'}</div>
            </div>
            <span class="value">${formatNumber(city.count)}</span>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Failed to load traffic analytics:', error);
  }
}

async function loadEngagementAnalytics() {
  try {
    const data = await apiRequest('/admin/analytics/engagement?period=30d');
    
    if (data.success) {
      // Reviews activity chart
      if (data.data.reviewsPerDay.length > 0) {
        const chartData = data.data.reviewsPerDay.map(d => ({
          date: d._id,
          count: d.count
        }));
        renderLineChart('engagement-reviews-chart', chartData, 'Reviews', '#f59e0b');
      }
      
      // Rating trend chart
      if (data.data.avgRatingTrend.length > 0) {
        const chartData = data.data.avgRatingTrend.map(d => ({
          date: d._id,
          count: d.avgRating
        }));
        renderLineChart('rating-trend-chart', chartData, 'Avg Rating', '#10b981');
      }
    }
    
    // Load cohort retention
    const retentionData = await apiRequest('/admin/analytics/retention');
    if (retentionData.success && retentionData.data.cohorts.length > 0) {
      const cohortEl = document.getElementById('cohort-table');
      cohortEl.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Users</th>
              <th>Returned</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            ${retentionData.data.cohorts.map(cohort => {
              const rate = cohort.total > 0 ? ((cohort.returned / cohort.total) * 100).toFixed(1) : 0;
              return `
                <tr>
                  <td>${cohort._id}</td>
                  <td>${cohort.total}</td>
                  <td>${cohort.returned}</td>
                  <td class="cohort-cell ${rate >= 50 ? 'high' : rate >= 25 ? 'medium' : 'low'}">${rate}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error('Failed to load engagement analytics:', error);
  }
}

async function loadMarketAnalytics() {
  try {
    const data = await apiRequest('/admin/analytics/market');
    
    if (data.success) {
      // Rent by city chart
      if (data.data.pricesByCity.length > 0) {
        const labels = data.data.pricesByCity.map(c => c._id);
        const values = data.data.pricesByCity.map(c => c.avgRent);
        renderBarChart('rent-by-city-chart', labels, values, '#6366f1');
      }
      
      // Demand chart
      if (data.data.demandByCity.length > 0) {
        const labels = data.data.demandByCity.map(c => c._id);
        const values = data.data.demandByCity.map(c => c.views);
        renderBarChart('demand-chart', labels, values, '#10b981');
      }
      
      // Top universities
      const unisEl = document.getElementById('top-universities-list');
      if (data.data.topUniversities.length > 0) {
        unisEl.innerHTML = data.data.topUniversities.map((uni, i) => `
          <div class="top-list-item">
            <span class="rank">${i + 1}</span>
            <div class="info">
              <div class="name">${uni._id}</div>
            </div>
            <span class="value">${uni.count} students</span>
          </div>
        `).join('');
      }
      
      // Top rated dorms
      const dormsEl = document.getElementById('top-rated-list');
      if (data.data.topRatedDorms.length > 0) {
        dormsEl.innerHTML = data.data.topRatedDorms.map((dorm, i) => `
          <div class="top-list-item">
            <span class="rank">${i + 1}</span>
            <div class="info">
              <div class="name">${dorm.name}</div>
              <div class="meta">${dorm.location?.address?.city || ''}</div>
            </div>
            <span class="value">${dorm.averageRating?.toFixed(1)} ★</span>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Failed to load market analytics:', error);
  }
}

// ============================================
// Reports Page
// ============================================

function setupReportsPageListeners() {
  document.getElementById('reports-status-filter')?.addEventListener('change', (e) => {
    state.filters.reports.status = e.target.value;
    state.pagination.reports.page = 1;
    loadReports();
  });
  
  document.getElementById('reports-type-filter')?.addEventListener('change', (e) => {
    state.filters.reports.targetType = e.target.value;
    state.pagination.reports.page = 1;
    loadReports();
  });
  
  document.getElementById('reports-priority-filter')?.addEventListener('change', (e) => {
    state.filters.reports.priority = e.target.value;
    state.pagination.reports.page = 1;
    loadReports();
  });
}

async function loadReports() {
  const listEl = document.getElementById('reports-list');
  listEl.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading reports...</span></div>';
  
  try {
    const params = new URLSearchParams({
      page: state.pagination.reports.page,
      limit: state.pagination.reports.limit,
      ...state.filters.reports
    });
    
    const data = await apiRequest(`/admin/reports?${params}`);
    
    if (data.success) {
      state.pagination.reports.total = data.data.pagination.total;
      renderReportsList(data.data.reports);
      updateReportsPagination(data.data.pagination);
      
      // Update stats
      const stats = await apiRequest('/admin/reports/stats');
      if (stats.success) {
        document.getElementById('reports-pending-count').textContent = stats.data.byStatus?.pending || 0;
        document.getElementById('reports-review-count').textContent = stats.data.byStatus?.under_review || 0;
        document.getElementById('reports-resolved-count').textContent = stats.data.byStatus?.resolved || 0;
      }
    }
  } catch (error) {
    listEl.innerHTML = '<div class="loading-placeholder">Failed to load reports</div>';
    showToast('Failed to load reports', 'error');
  }
}

function renderReportsList(reports) {
  const listEl = document.getElementById('reports-list');
  
  if (reports.length === 0) {
    listEl.innerHTML = '<div class="loading-placeholder">No reports found</div>';
    return;
  }
  
  listEl.innerHTML = reports.map(report => `
    <div class="report-item priority-${report.priority}" data-id="${report._id}">
      <div class="report-item-header">
        <div>
          <div class="report-item-title">
            <span class="status-badge ${report.status}">${report.status}</span>
            ${report.reason.replace(/_/g, ' ')}
          </div>
          <div class="report-item-meta">
            Reported by ${report.reporter?.name || 'Anonymous'} · ${formatDate(report.createdAt)}
          </div>
        </div>
        <span class="status-badge ${report.priority}">${report.priority}</span>
      </div>
      <div class="report-item-body">${report.description || 'No description provided'}</div>
      <div class="report-item-footer">
        <span class="report-item-target">
          <i class="fas fa-${report.targetType === 'review' ? 'star' : report.targetType === 'dorm' ? 'building' : 'user'}"></i>
          ${report.targetType}: ${report.target?.name || report.target?.title || report.targetId}
        </span>
        <div class="report-item-actions">
          <button class="btn-small" onclick="viewReport('${report._id}')">View</button>
          ${report.status === 'pending' ? `
            <button class="btn-small" onclick="resolveReport('${report._id}')">Resolve</button>
            <button class="btn-small" onclick="dismissReport('${report._id}')">Dismiss</button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function updateReportsPagination(pagination) {
  document.getElementById('reports-current-page').textContent = pagination.current;
  document.getElementById('reports-total-pages').textContent = pagination.pages;
  document.getElementById('reports-prev').disabled = pagination.current <= 1;
  document.getElementById('reports-next').disabled = pagination.current >= pagination.pages;
}

async function viewReport(id) {
  try {
    const data = await apiRequest(`/admin/reports/${id}`);
    
    if (data.success) {
      const report = data.data;
      const modalBody = document.getElementById('report-modal-body');
      
      modalBody.innerHTML = `
        <div>
          <p><strong>Reason:</strong> ${report.reason.replace(/_/g, ' ')}</p>
          <p><strong>Description:</strong> ${report.description || 'No description'}</p>
          <p><strong>Reporter:</strong> ${report.reporter?.name || 'Anonymous'}</p>
          <p><strong>Target Type:</strong> ${report.targetType}</p>
          <p><strong>Status:</strong> <span class="status-badge ${report.status}">${report.status}</span></p>
          <p><strong>Priority:</strong> <span class="status-badge ${report.priority}">${report.priority}</span></p>
          <p><strong>Created:</strong> ${formatDate(report.createdAt)}</p>
          ${report.resolution ? `
            <hr style="margin: 16px 0;">
            <p><strong>Resolution:</strong> ${report.resolution.action}</p>
            <p><strong>Notes:</strong> ${report.resolution.notes || '-'}</p>
            <p><strong>Resolved by:</strong> ${report.resolution.resolvedBy?.name || 'Unknown'}</p>
            <p><strong>Resolved at:</strong> ${formatDate(report.resolution.resolvedAt)}</p>
          ` : ''}
        </div>
      `;
      
      document.getElementById('report-dismiss-btn').onclick = () => dismissReport(id);
      document.getElementById('report-resolve-btn').onclick = () => confirmResolveReport(id);
      
      openModal('report-modal');
    }
  } catch (error) {
    showToast('Failed to load report details', 'error');
  }
}

async function dismissReport(id) {
  try {
    await apiRequest(`/admin/reports/${id}/dismiss`, 'POST', { reason: 'Dismissed by admin' });
    showToast('Report dismissed', 'success');
    loadReports();
    closeAllModals();
  } catch (error) {
    showToast('Failed to dismiss report', 'error');
  }
}

async function resolveReport(id) {
  confirmResolveReport(id);
}

function confirmResolveReport(id) {
  const confirmInput = document.getElementById('confirm-input');
  document.getElementById('confirm-title').textContent = 'Resolve Report';
  document.getElementById('confirm-message').textContent = 'How do you want to resolve this report?';
  document.getElementById('confirm-input-group').style.display = 'block';
  document.getElementById('confirm-input-label').textContent = 'Resolution Notes';
  confirmInput.value = '';
  
  document.getElementById('confirm-action-btn').onclick = async () => {
    try {
      await apiRequest(`/admin/reports/${id}/resolve`, 'POST', {
        action: 'resolved',
        notes: confirmInput.value
      });
      showToast('Report resolved successfully', 'success');
      loadReports();
      closeAllModals();
    } catch (error) {
      showToast('Failed to resolve report', 'error');
    }
  };
  
  openModal('confirm-modal');
}

// ============================================
// Settings Page
// ============================================

function setupSettingsPageListeners() {
  // Save buttons
  document.getElementById('save-general-settings')?.addEventListener('click', saveGeneralSettings);
  document.getElementById('save-moderation-settings')?.addEventListener('click', saveModerationSettings);
  document.getElementById('save-features-settings')?.addEventListener('click', saveFeaturesSettings);
  document.getElementById('save-security-settings')?.addEventListener('click', saveSecuritySettings);
  
  // Clear cache
  document.getElementById('clear-cache-btn')?.addEventListener('click', clearCache);
}

async function loadSettings() {
  try {
    const data = await apiRequest('/admin/settings');
    
    if (data.success) {
      const settings = data.data;
      
      // General
      document.getElementById('setting-site-name').value = settings.general.siteName || '';
      document.getElementById('setting-support-email').value = settings.general.supportEmail || '';
      document.getElementById('setting-timezone').value = settings.general.timezone || 'UTC';
      document.getElementById('setting-maintenance-mode').checked = settings.general.maintenanceMode || false;
      document.getElementById('setting-maintenance-message').value = settings.general.maintenanceMessage || '';
      
      // Moderation
      document.getElementById('setting-auto-approve-reviews').checked = settings.moderation.autoApproveReviews || false;
      document.getElementById('setting-require-photo').checked = settings.moderation.requirePhotoForReview || false;
      document.getElementById('setting-min-review-length').value = settings.moderation.minReviewLength || 50;
      document.getElementById('setting-max-reviews-per-day').value = settings.moderation.maxReviewsPerUserPerDay || 5;
      document.getElementById('setting-profanity-filter').checked = settings.moderation.profanityFilterEnabled !== false;
      document.getElementById('setting-spam-filter').checked = settings.moderation.spamFilterEnabled !== false;
      
      // Features
      document.getElementById('feature-roommate-matching').checked = settings.features.roommateMatchingEnabled !== false;
      document.getElementById('feature-landlord-chat').checked = settings.features.landlordChatEnabled !== false;
      document.getElementById('feature-qna').checked = settings.features.qnaEnabled !== false;
      document.getElementById('feature-blog').checked = settings.features.blogEnabled !== false;
      document.getElementById('feature-compare-dorms').checked = settings.features.compareDormsEnabled !== false;
      document.getElementById('feature-price-alerts').checked = settings.features.priceAlertsEnabled !== false;
      
      // Security
      document.getElementById('setting-max-login-attempts').value = settings.security.maxLoginAttempts || 5;
      document.getElementById('setting-lockout-duration').value = settings.security.lockoutDurationMinutes || 30;
      document.getElementById('setting-session-timeout').value = settings.security.sessionTimeoutMinutes || 60;
      document.getElementById('setting-require-email-verification').checked = settings.security.requireEmailVerification !== false;
      document.getElementById('setting-social-login').checked = settings.security.allowSocialLogin !== false;
    }
  } catch (error) {
    showToast('Failed to load settings', 'error');
  }
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.settingsTab === tab);
  });
  
  document.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tab}-settings`);
  });
}

async function saveGeneralSettings() {
  try {
    await apiRequest('/admin/settings/general', 'PUT', {
      siteName: document.getElementById('setting-site-name').value,
      supportEmail: document.getElementById('setting-support-email').value,
      timezone: document.getElementById('setting-timezone').value,
      maintenanceMode: document.getElementById('setting-maintenance-mode').checked,
      maintenanceMessage: document.getElementById('setting-maintenance-message').value
    });
    showToast('General settings saved', 'success');
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
}

async function saveModerationSettings() {
  try {
    await apiRequest('/admin/settings/moderation', 'PUT', {
      autoApproveReviews: document.getElementById('setting-auto-approve-reviews').checked,
      requirePhotoForReview: document.getElementById('setting-require-photo').checked,
      minReviewLength: parseInt(document.getElementById('setting-min-review-length').value),
      maxReviewsPerUserPerDay: parseInt(document.getElementById('setting-max-reviews-per-day').value),
      profanityFilterEnabled: document.getElementById('setting-profanity-filter').checked,
      spamFilterEnabled: document.getElementById('setting-spam-filter').checked
    });
    showToast('Moderation settings saved', 'success');
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
}

async function saveFeaturesSettings() {
  try {
    await apiRequest('/admin/settings/features', 'PUT', {
      roommateMatchingEnabled: document.getElementById('feature-roommate-matching').checked,
      landlordChatEnabled: document.getElementById('feature-landlord-chat').checked,
      qnaEnabled: document.getElementById('feature-qna').checked,
      blogEnabled: document.getElementById('feature-blog').checked,
      compareDormsEnabled: document.getElementById('feature-compare-dorms').checked,
      priceAlertsEnabled: document.getElementById('feature-price-alerts').checked
    });
    showToast('Feature settings saved', 'success');
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
}

async function saveSecuritySettings() {
  try {
    await apiRequest('/admin/settings/security', 'PUT', {
      maxLoginAttempts: parseInt(document.getElementById('setting-max-login-attempts').value),
      lockoutDurationMinutes: parseInt(document.getElementById('setting-lockout-duration').value),
      sessionTimeoutMinutes: parseInt(document.getElementById('setting-session-timeout').value),
      requireEmailVerification: document.getElementById('setting-require-email-verification').checked,
      allowSocialLogin: document.getElementById('setting-social-login').checked
    });
    showToast('Security settings saved', 'success');
  } catch (error) {
    showToast('Failed to save settings', 'error');
  }
}

async function clearCache() {
  try {
    await apiRequest('/admin/settings/cache/clear', 'POST');
    showToast('Cache cleared successfully', 'success');
  } catch (error) {
    showToast('Failed to clear cache', 'error');
  }
}

// ============================================
// Confirmation Modal
// ============================================

function confirmAction(action, type, id) {
  const titles = {
    ban: 'Ban User',
    delete: `Delete ${type}`,
    reject: 'Reject Dorm'
  };
  
  const messages = {
    ban: 'Are you sure you want to ban this user? They will not be able to access the platform.',
    delete: `Are you sure you want to delete this ${type}? This action cannot be undone.`,
    reject: 'Are you sure you want to reject this dorm? The owner will be notified.'
  };
  
  document.getElementById('confirm-title').textContent = titles[action] || 'Confirm Action';
  document.getElementById('confirm-message').textContent = messages[action] || 'Are you sure?';
  document.getElementById('confirm-input-group').style.display = action === 'ban' || action === 'reject' ? 'block' : 'none';
  document.getElementById('confirm-input-label').textContent = 'Reason (optional)';
  document.getElementById('confirm-input').value = '';
  
  document.getElementById('confirm-action-btn').onclick = () => {
    const reason = document.getElementById('confirm-input').value;
    executeAction(action, type, id, reason);
  };
  
  openModal('confirm-modal');
}

async function executeAction(action, type, id, reason) {
  try {
    switch (action) {
      case 'ban':
        await banUser(id, reason);
        break;
      case 'delete':
        await apiRequest(`/admin/${type}s/${id}`, 'DELETE', { reason });
        showToast(`${type} deleted successfully`, 'success');
        refreshCurrentPage();
        break;
      case 'reject':
        await apiRequest(`/admin/dorms/${id}/reject`, 'POST', { reason });
        showToast('Dorm rejected', 'success');
        loadDorms();
        break;
    }
    closeAllModals();
  } catch (error) {
    showToast(`Failed to ${action} ${type}`, 'error');
  }
}

// ============================================
// Modals
// ============================================

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ============================================
// Reports Badge
// ============================================

async function updateReportsBadge() {
  try {
    const data = await apiRequest('/admin/reports/stats');
    if (data.success) {
      const pending = data.data.byStatus?.pending || 0;
      const badge = document.getElementById('reports-badge');
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Failed to update reports badge:', error);
  }
}

// ============================================
// Utility Functions
// ============================================

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num?.toString() || '0';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function updateSelectedUsers() {
  const checkboxes = document.querySelectorAll('#users-table-body input[type="checkbox"]:checked');
  state.selectedItems.users = Array.from(checkboxes).map(cb => cb.value);
}

// Make functions globally available
window.viewUser = viewUser;
window.verifyUser = verifyUser;
window.viewDorm = viewDorm;
window.approveDorm = approveDorm;
window.viewReview = viewReview;
window.approveReview = approveReview;
window.viewRoommateProfile = async (id) => {
  showToast('Profile viewer not implemented yet', 'info');
};
window.viewReport = viewReport;
window.resolveReport = resolveReport;
window.dismissReport = dismissReport;
window.confirmAction = confirmAction;
window.updateSelectedUsers = updateSelectedUsers;
