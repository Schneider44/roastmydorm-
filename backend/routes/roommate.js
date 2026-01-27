// Roommate API Routes
// Replace these with real database calls

const express = require('express');
const router = express.Router();
const RoommateController = require('../controllers/roommateController');

// Profile routes
router.post('/profiles', RoommateController.createProfile);
router.get('/profiles/me', RoommateController.getMyProfile);
router.put('/profiles/me', RoommateController.updateProfile);
router.get('/profiles', RoommateController.getAllProfiles);
router.get('/profiles/:id', RoommateController.getProfileById);

// Matching routes
router.get('/matches', RoommateController.getMatches);
router.get('/matches/compatibility/:id', RoommateController.getCompatibilityScore);

// Message routes
router.post('/messages', RoommateController.sendMessage);
router.get('/messages/:partnerId', RoommateController.getMessages);
router.put('/messages/:id/read', RoommateController.markMessageRead);

// Match confirmation routes
router.post('/matches/confirm', RoommateController.confirmMatch);
router.get('/matches/confirmed', RoommateController.getConfirmedMatches);

// Meeting routes
router.post('/meetings', RoommateController.scheduleMeeting);
router.get('/meetings', RoommateController.getMyMeetings);

module.exports = router;


























