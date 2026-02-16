const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const Profile = require('../models/Profile');

// Multer config for avatar upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/avatars'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, req.user._id + '_' + Date.now() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Invalid file type'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }
});

// POST /api/profiles/me/avatar
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = '/uploads/avatars/' + req.file.filename;
  const profile = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { avatarUrl, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  res.json({ success: true, avatarUrl, profile });
});

module.exports = router;
