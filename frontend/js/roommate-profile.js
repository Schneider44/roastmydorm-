// Profile Form Handler

const allInterests = ['Reading', 'Gaming', 'Music', 'Sports', 'Cooking', 'Art', 'Photography', 'Yoga', 'Travel', 'Tech', 'Writing', 'Hiking', 'Movies', 'Dancing'];

// Initialize interests checkboxes
document.addEventListener('DOMContentLoaded', function() {
  const interestsContainer = document.getElementById('interests-container');
  if (interestsContainer) {
    allInterests.forEach(interest => {
      const label = document.createElement('label');
      label.className = 'interest-checkbox';
      label.innerHTML = `
        <input type="checkbox" value="${interest}" name="interests">
        <span>${interest}</span>
      `;
      interestsContainer.appendChild(label);
    });
  }

  // Load existing profile if editing
  loadExistingProfile();
});

function handlePhotoChange(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = function() {
      const preview = document.getElementById('photo-preview');
      const placeholder = document.getElementById('photo-placeholder');
      preview.src = reader.result;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

function loadExistingProfile() {
  const profile = RoommateDB.getMyProfile();
  if (profile) {
    document.getElementById('form-title').textContent = 'Edit Your Profile';
    document.getElementById('name').value = profile.name || '';
    document.getElementById('age').value = profile.age || '';
    document.getElementById('university').value = profile.university || '';
    document.getElementById('location').value = profile.location || '';
    document.getElementById('cleanliness').value = profile.cleanlinessLevel || 3;
    document.getElementById('cleanliness-value').textContent = profile.cleanlinessLevel || 3;
    document.getElementById('sleepSchedule').value = profile.sleepSchedule || 'Regular (11 PM - 7 AM)';
    document.getElementById('studyHabits').value = profile.studyHabits || 'Quiet study preferred';
    document.getElementById('socialLevel').value = profile.socialLevel || 'Moderate';
    document.getElementById('personality').value = profile.personality || 'Ambivert';
    document.getElementById('smokingPreference').value = profile.smokingPreference || 'No smoking';
    document.getElementById('petsTolerance').value = profile.petsTolerance || 'Neutral';
    document.getElementById('budgetMin').value = profile.budgetMin || '';
    document.getElementById('budgetMax').value = profile.budgetMax || '';
    document.getElementById('bio').value = profile.bio || '';

    if (profile.profilePhoto) {
      const preview = document.getElementById('photo-preview');
      const placeholder = document.getElementById('photo-placeholder');
      preview.src = profile.profilePhoto;
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    }

    // Check interests
    if (profile.interests) {
      profile.interests.forEach(interest => {
        const checkbox = document.querySelector(`input[value="${interest}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }
  }
}

// Handle form submission
document.getElementById('profile-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // Get form data
  const formData = new FormData(e.target);
  const profileData = {
    name: formData.get('name'),
    age: parseInt(formData.get('age')),
    university: formData.get('university'),
    location: formData.get('location'),
    cleanlinessLevel: parseInt(formData.get('cleanlinessLevel')),
    sleepSchedule: formData.get('sleepSchedule'),
    studyHabits: formData.get('studyHabits'),
    socialLevel: formData.get('socialLevel'),
    personality: formData.get('personality'),
    interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value),
    smokingPreference: formData.get('smokingPreference'),
    petsTolerance: formData.get('petsTolerance'),
    budgetMin: parseInt(formData.get('budgetMin')),
    budgetMax: parseInt(formData.get('budgetMax')),
    bio: formData.get('bio')
  };

  // Get photo
  const photoInput = document.getElementById('profile-photo');
  if (photoInput.files[0]) {
    const reader = new FileReader();
    reader.onloadend = function() {
      profileData.profilePhoto = reader.result;
      saveProfile(profileData);
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    const existingProfile = RoommateDB.getMyProfile();
    if (existingProfile && existingProfile.profilePhoto) {
      profileData.profilePhoto = existingProfile.profilePhoto;
    }
    saveProfile(profileData);
  }
});

function saveProfile(profileData) {
  try {
    RoommateDB.saveProfile(profileData);
    alert('Profile saved successfully!');
    window.location.href = 'find-roommate-matches.html';
  } catch (error) {
    alert('Error saving profile. Please try again.');
    console.error(error);
  }
}

