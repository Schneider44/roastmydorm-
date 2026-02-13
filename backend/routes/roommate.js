// Roommate API Routes
// Replace these with real database calls

const express = require('express');
const router = express.Router();
const RoommateController = require('../controllers/roommateController');
const { auth } = require('../middleware/auth');

// Profile routes - All routes require authentication
router.post('/profiles', auth, RoommateController.createProfile);
router.get('/profiles/me', auth, RoommateController.getMyProfile);
router.put('/profiles/me', auth, RoommateController.updateProfile);
router.get('/profiles', auth, RoommateController.getAllProfiles);
router.get('/profiles/:id', auth, RoommateController.getProfileById);

// Matching routes
router.get('/matches', auth, RoommateController.getMatches);
router.get('/matches/compatibility/:id', auth, RoommateController.getCompatibilityScore);

// Message routes
router.post('/messages', auth, RoommateController.sendMessage);
router.get('/messages/:partnerId', auth, RoommateController.getMessages);
router.put('/messages/:id/read', auth, RoommateController.markMessageRead);

// Match confirmation routes
router.post('/matches/confirm', auth, RoommateController.confirmMatch);
router.get('/matches/confirmed', auth, RoommateController.getConfirmedMatches);

// Meeting routes
router.post('/meetings', auth, RoommateController.scheduleMeeting);
router.get('/meetings', auth, RoommateController.getMyMeetings);

module.exports = router;


























