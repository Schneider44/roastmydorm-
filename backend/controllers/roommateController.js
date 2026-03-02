const RoommateProfile = require('../models/RoommateProfile');
const RoommateMessage = require('../models/RoommateMessage');
const RoommateMatch = require('../models/RoommateMatch');
const { calculateMatchScore, sortByMatchScore } = require('../utils/matchScore');

const RoommateController = {

  // POST /api/roommate/profiles — create or update my profile
  createProfile: async (req, res) => {
    try {
      const userId = req.user._id;
      const data = { ...req.body, userId, updatedAt: new Date() };

      let profile = await RoommateProfile.findOne({ userId });
      if (profile) {
        Object.assign(profile, data);
        await profile.save();
        return res.json({ success: true, data: profile });
      }

      profile = await RoommateProfile.create(data);
      res.status(201).json({ success: true, data: profile });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/profiles/me
  getMyProfile: async (req, res) => {
    try {
      const profile = await RoommateProfile.findOne({ userId: req.user._id });
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      res.json({ success: true, data: profile });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/roommate/profiles/me
  updateProfile: async (req, res) => {
    try {
      const profile = await RoommateProfile.findOneAndUpdate(
        { userId: req.user._id },
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      res.json({ success: true, data: profile });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/profiles — all profiles except mine and confirmed matches
  getAllProfiles: async (req, res) => {
    try {
      const userId = req.user._id;

      const confirmed = await RoommateMatch.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: 'confirmed'
      });
      const confirmedIds = confirmed.map(m =>
        m.user1Id.toString() === userId.toString() ? m.user2Id : m.user1Id
      );

      const profiles = await RoommateProfile.find({
        userId: { $ne: userId, $nin: confirmedIds },
        isActive: true
      }).lean();

      res.json({ success: true, data: profiles });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/profiles/:id
  getProfileById: async (req, res) => {
    try {
      let profile = await RoommateProfile.findById(req.params.id).catch(() => null);
      if (!profile) profile = await RoommateProfile.findOne({ userId: req.params.id });
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      res.json({ success: true, data: profile });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/matches — profiles sorted by compatibility score
  getMatches: async (req, res) => {
    try {
      const userId = req.user._id;
      const myProfile = await RoommateProfile.findOne({ userId }).lean();
      if (!myProfile) return res.json({ success: true, data: [] });

      const confirmed = await RoommateMatch.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: 'confirmed'
      });
      const confirmedIds = confirmed.map(m =>
        m.user1Id.toString() === userId.toString() ? m.user2Id : m.user1Id
      );

      const others = await RoommateProfile.find({
        userId: { $ne: userId, $nin: confirmedIds },
        isActive: true
      }).lean();

      const sorted = sortByMatchScore(myProfile, others);
      res.json({ success: true, data: sorted });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/matches/compatibility/:id
  getCompatibilityScore: async (req, res) => {
    try {
      const myProfile = await RoommateProfile.findOne({ userId: req.user._id }).lean();
      let other = await RoommateProfile.findById(req.params.id).lean().catch(() => null);
      if (!other) other = await RoommateProfile.findOne({ userId: req.params.id }).lean();
      if (!myProfile || !other) return res.status(404).json({ success: false, message: 'Profile not found' });
      const score = calculateMatchScore(myProfile, other);
      res.json({ success: true, data: score });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/roommate/messages
  sendMessage: async (req, res) => {
    try {
      const { receiverId, text } = req.body;
      const msg = await RoommateMessage.create({
        senderId: req.user._id,
        receiverId,
        text
      });
      res.status(201).json({ success: true, data: msg });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/messages/:partnerId
  getMessages: async (req, res) => {
    try {
      const userId = req.user._id;
      const { partnerId } = req.params;
      const messages = await RoommateMessage.find({
        $or: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId }
        ]
      }).sort({ createdAt: 1 });
      res.json({ success: true, data: messages });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // PUT /api/roommate/messages/:id/read
  markMessageRead: async (req, res) => {
    try {
      const msg = await RoommateMessage.findByIdAndUpdate(
        req.params.id, { read: true }, { new: true }
      );
      if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
      res.json({ success: true, data: msg });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // POST /api/roommate/matches/confirm
  confirmMatch: async (req, res) => {
    try {
      const user1Id = req.user._id;
      const { user2Id } = req.body;
      const match = await RoommateMatch.findOneAndUpdate(
        { $or: [{ user1Id, user2Id }, { user1Id: user2Id, user2Id: user1Id }] },
        { user1Id, user2Id, confirmedBy: user1Id, status: 'confirmed', confirmedAt: new Date() },
        { upsert: true, new: true }
      );
      res.json({ success: true, data: match });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  // GET /api/roommate/matches/confirmed
  getConfirmedMatches: async (req, res) => {
    try {
      const userId = req.user._id;
      const matches = await RoommateMatch.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: 'confirmed'
      });
      res.json({ success: true, data: matches });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  scheduleMeeting: async (req, res) => {
    res.json({ success: true, data: { ...req.body, scheduledBy: req.user._id, createdAt: new Date() } });
  },

  getMyMeetings: async (req, res) => {
    res.json({ success: true, data: [] });
  }
};

module.exports = RoommateController;
