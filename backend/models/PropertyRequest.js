const mongoose = require('mongoose');

const propertyRequestSchema = new mongoose.Schema({
  // ── Landlord Info ──
  landlordName:  { type: String, required: true, trim: true },
  landlordEmail: { type: String, required: true, trim: true, lowercase: true },
  landlordPhone: { type: String, trim: true },
  landlordType:  { type: String, enum: ['individual', 'agency', 'developer', 'other'], default: 'individual' },

  // ── Property Info ──
  title:        { type: String, required: true, trim: true },
  propertyType: { type: String, required: true, enum: ['studio', 'apartment', 'house', 'room', 'colocation'] },
  city:         { type: String, required: true, enum: ['casablanca', 'rabat', 'marrakech', 'other'] },
  neighborhood: { type: String, trim: true },
  address:      { type: String, trim: true },
  price:        { type: Number, required: true, min: 0 },
  description:  { type: String, required: true, trim: true },
  amenities:    [{ type: String, trim: true }],
  furnished:    { type: Boolean, default: false },
  availableFrom:{ type: Date },

  // ── Admin Review ──
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String, trim: true },
  reviewedAt:{ type: Date },
  reviewedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Notification Tracking ──
  notifiedLandlord: { type: Boolean, default: false },

}, { timestamps: true });

propertyRequestSchema.index({ status: 1, createdAt: -1 });
propertyRequestSchema.index({ landlordEmail: 1 });

module.exports = mongoose.model('PropertyRequest', propertyRequestSchema);
