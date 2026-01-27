// Chat Handler

let partnerId = null;
let partnerProfile = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', function() {
  // Get partner ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  partnerId = urlParams.get('id');
  
  if (!partnerId) {
    alert('No partner ID provided');
    window.location.href = 'find-roommate-matches.html';
    return;
  }

  currentUserId = RoommateDB.getCurrentUserId();
  loadChat();
  
  // Setup meeting type toggle
  document.querySelectorAll('input[name="meetingType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.getElementById('external-link-group').style.display = 
        this.value === 'external' ? 'block' : 'none';
    });
  });

  // Set min date for meeting
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('meeting-date').setAttribute('min', today);
});

function loadChat() {
  partnerProfile = RoommateDB.getProfileById(partnerId);
  
  if (!partnerProfile) {
    alert('Profile not found');
    window.location.href = 'find-roommate-matches.html';
    return;
  }

  // Display partner info
  document.getElementById('partner-name').textContent = partnerProfile.name;
  document.getElementById('partner-info').textContent = 
    `${partnerProfile.university} • ${partnerProfile.location}`;
  
  if (partnerProfile.profilePhoto) {
    document.getElementById('partner-photo').src = partnerProfile.profilePhoto;
    document.getElementById('partner-photo').style.display = 'block';
  }

  // Load messages
  loadMessages();

  // Check if confirmed or declined
  const isConfirmed = RoommateDB.isConfirmed(currentUserId, partnerId);
  const isDeclined = RoommateDB.isDeclined(currentUserId, partnerId);
  
  if (isConfirmed) {
    document.getElementById('confirmed-message').style.display = 'block';
    document.getElementById('match-buttons').style.display = 'none';
    document.getElementById('declined-message').style.display = 'none';
  } else if (isDeclined) {
    document.getElementById('declined-message').style.display = 'block';
    document.getElementById('match-buttons').style.display = 'none';
    document.getElementById('confirmed-message').style.display = 'none';
  } else {
    document.getElementById('match-buttons').style.display = 'flex';
    document.getElementById('confirmed-message').style.display = 'none';
    document.getElementById('declined-message').style.display = 'none';
  }
}

function loadMessages() {
  const messages = RoommateDB.getMessages(currentUserId, partnerId);
  const container = document.getElementById('messages-container');
  
  if (messages.length === 0) {
    document.getElementById('no-messages').style.display = 'block';
    container.innerHTML = '';
    return;
  }

  document.getElementById('no-messages').style.display = 'none';
  container.innerHTML = '';

  messages.forEach(message => {
    const isOwn = message.senderId === currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    
    const time = new Date(message.createdAt).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
      <div class="message-bubble">
        <div>${message.text}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
    
    container.appendChild(messageDiv);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if (!text) return;

  try {
    RoommateDB.saveMessage(currentUserId, partnerId, text);
    input.value = '';
    loadMessages();
  } catch (error) {
    alert('Error sending message');
    console.error(error);
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function confirmMatch() {
  if (!confirm('Are you sure you want to confirm this roommate match? Once confirmed, both profiles will be removed from the match list.')) {
    return;
  }

  try {
    RoommateDB.confirmMatch(currentUserId, partnerId, currentUserId);
    document.getElementById('confirmed-message').style.display = 'block';
    document.getElementById('match-buttons').style.display = 'none';
    document.getElementById('declined-message').style.display = 'none';
    alert('Roommate match confirmed!');
  } catch (error) {
    alert('Error confirming match');
    console.error(error);
  }
}

function declineMatch() {
  if (!confirm('Are you sure you want to decline this roommate match? This action cannot be undone.')) {
    return;
  }

  try {
    RoommateDB.declineMatch(currentUserId, partnerId);
    document.getElementById('declined-message').style.display = 'block';
    document.getElementById('match-buttons').style.display = 'none';
    document.getElementById('confirmed-message').style.display = 'none';
    alert('Roommate match declined.');
  } catch (error) {
    alert('Error declining match');
    console.error(error);
  }
}

function openScheduleModal() {
  document.getElementById('schedule-modal').style.display = 'flex';
}

function closeScheduleModal() {
  document.getElementById('schedule-modal').style.display = 'none';
}

function submitMeeting(event) {
  event.preventDefault();
  
  const meetingType = document.querySelector('input[name="meetingType"]:checked').value;
  const meetingLink = document.getElementById('meeting-link').value;
  const meetingDate = document.getElementById('meeting-date').value;
  const meetingTime = document.getElementById('meeting-time').value;
  const notes = document.getElementById('meeting-notes').value;

  if (meetingType === 'external' && !meetingLink) {
    alert('Please provide a meeting link');
    return;
  }

  const meetingData = {
    matchId: `${currentUserId}_${partnerId}`,
    scheduledBy: currentUserId,
    meetingType,
    meetingLink: meetingType === 'external' ? meetingLink : null,
    scheduledDate: meetingDate,
    scheduledTime: meetingTime,
    notes
  };

  try {
    RoommateDB.scheduleMeeting(meetingData);
    alert('Meeting scheduled successfully!');
    closeScheduleModal();
    document.getElementById('meeting-form').reset();
  } catch (error) {
    alert('Error scheduling meeting');
    console.error(error);
  }
}


