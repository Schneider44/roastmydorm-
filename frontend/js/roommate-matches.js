// Match Feed Handler

let allMatches = [];
let filteredMatches = [];

document.addEventListener('DOMContentLoaded', function() {
  loadMatches();
});

function loadMatches() {
  const currentProfile = RoommateDB.getMyProfile();
  
  if (!currentProfile) {
    document.getElementById('no-profile-message').style.display = 'block';
    return;
  }

  document.getElementById('match-feed-content').style.display = 'block';
  
  const availableProfiles = RoommateDB.getAvailableProfiles();
  allMatches = sortByMatchScore(currentProfile, availableProfiles);
  
  populateFilters();
  filterMatches();
}

function populateFilters() {
  const universities = new Set();
  const locations = new Set();
  
  allMatches.forEach(({ profile }) => {
    if (profile.university) universities.add(profile.university);
    if (profile.location) locations.add(profile.location);
  });

  const universitySelect = document.getElementById('filter-university');
  const locationSelect = document.getElementById('filter-location');

  Array.from(universities).sort().forEach(uni => {
    const option = document.createElement('option');
    option.value = uni;
    option.textContent = uni;
    universitySelect.appendChild(option);
  });

  Array.from(locations).sort().forEach(loc => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    locationSelect.appendChild(option);
  });
}

function filterMatches() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const university = document.getElementById('filter-university').value;
  const location = document.getElementById('filter-location').value;
  const minBudget = document.getElementById('filter-min-budget').value;
  const maxBudget = document.getElementById('filter-max-budget').value;
  const personality = document.getElementById('filter-personality').value;
  const social = document.getElementById('filter-social').value;

  filteredMatches = allMatches.filter(({ profile }) => {
    if (searchQuery) {
      const matchesSearch = 
        profile.name?.toLowerCase().includes(searchQuery) ||
        profile.university?.toLowerCase().includes(searchQuery) ||
        profile.location?.toLowerCase().includes(searchQuery) ||
        profile.bio?.toLowerCase().includes(searchQuery);
      if (!matchesSearch) return false;
    }

    if (university && profile.university !== university) return false;
    if (location && profile.location !== location) return false;
    if (minBudget && profile.budgetMax < parseInt(minBudget)) return false;
    if (maxBudget && profile.budgetMin > parseInt(maxBudget)) return false;
    if (personality && profile.personality !== personality) return false;
    if (social && profile.socialLevel !== social) return false;

    return true;
  });

  displayMatches();
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-university').value = '';
  document.getElementById('filter-location').value = '';
  document.getElementById('filter-min-budget').value = '';
  document.getElementById('filter-max-budget').value = '';
  document.getElementById('filter-personality').value = '';
  document.getElementById('filter-social').value = '';
  filterMatches();
}

function displayMatches() {
  const container = document.getElementById('matches-container');
  container.innerHTML = '';

  if (filteredMatches.length === 0) {
    document.getElementById('no-matches').style.display = 'block';
    document.getElementById('matches-count').style.display = 'none';
    document.getElementById('matches-stats').querySelector('span:first-of-type').textContent = '0';
    return;
  }

  document.getElementById('no-matches').style.display = 'none';
  document.getElementById('matches-count').style.display = 'inline-block';
  document.getElementById('matches-count').innerHTML = `
    <i class="fas fa-users"></i> Found <strong>${filteredMatches.length}</strong> ${filteredMatches.length === 1 ? 'match' : 'matches'}
  `;
  
  document.getElementById('matches-stats').querySelector('span:first-of-type').textContent = filteredMatches.length;

  filteredMatches.forEach(({ profile, matchScore }) => {
    const card = createMatchCard(profile, matchScore);
    container.appendChild(card);
  });
}

function createMatchCard(profile, matchScore) {
  const card = document.createElement('div');
  card.className = 'match-card';

  const scoreClass = matchScore.score >= 80 ? 'score-high' : 
                     matchScore.score >= 60 ? 'score-medium' : 'score-low';
  
  const scoreIcon = matchScore.score >= 80 ? '<i class="fas fa-heart"></i>' :
                     matchScore.score >= 60 ? '<i class="fas fa-star"></i>' : 
                     '<i class="fas fa-handshake"></i>';

  card.innerHTML = `
    <div class="match-card-header">
      <img src="${profile.profilePhoto || 'https://i.pravatar.cc/150?img=1'}" alt="${profile.name}" class="match-card-photo">
      <div class="match-info">
        <h3>${profile.name}</h3>
        <p><i class="fas fa-birthday-cake"></i> Age ${profile.age}</p>
        <p><i class="fas fa-map-marker-alt"></i> ${profile.location}</p>
        <p><i class="fas fa-graduation-cap"></i> ${profile.university}</p>
        <span class="match-score-badge ${scoreClass}">
          ${scoreIcon} ${matchScore.score}% Match
        </span>
      </div>
    </div>
    <div class="match-tags">
      <span class="match-tag tag-blue"><i class="fas fa-user"></i> ${profile.personality}</span>
      <span class="match-tag tag-purple"><i class="fas fa-users"></i> ${profile.socialLevel}</span>
      <span class="match-tag tag-green"><i class="fas fa-sparkles"></i> Clean: ${profile.cleanlinessLevel}/5</span>
    </div>
    <div class="match-bio">${profile.bio || 'No bio available.'}</div>
    <div class="match-budget">
      <i class="fas fa-money-bill-wave"></i>
      <span>Budget: ${profile.budgetMin} - ${profile.budgetMax} MAD</span>
    </div>
    ${profile.interests && profile.interests.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${profile.interests.slice(0, 4).map(i => `
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.75rem; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 0.5rem; font-size: 0.75rem; font-weight: 500; color: #667eea;">
              <i class="fas fa-check-circle"></i> ${i}
            </span>
          `).join('')}
          ${profile.interests.length > 4 ? `
            <span style="display: inline-flex; align-items: center; padding: 0.375rem 0.75rem; background: #f3f4f6; border-radius: 0.5rem; font-size: 0.75rem; color: #6b7280; font-weight: 600;">
              +${profile.interests.length - 4} more
            </span>
          ` : ''}
        </div>
      </div>
    ` : ''}
    <div class="match-actions">
      <a href="find-roommate-chat.html?id=${profile.userId}" class="btn-chat">
        <i class="fas fa-comments"></i> Chat
      </a>
      <button class="btn-view" onclick="viewProfile('${profile.userId}')">
        <i class="fas fa-eye"></i> View
      </button>
    </div>
  `;

  return card;
}

function viewProfile(userId) {
  // Could open a modal or navigate to profile page
  alert('Profile view coming soon!');
}

