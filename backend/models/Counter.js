const mongoose = require('mongoose');

/**
 * Generic atomic sequence counter (one document per named sequence), used to
 * generate short human-readable reference codes like "RMD-1842" without a
 * race condition between concurrent requests - see getNextSequence() below,
 * which relies on findOneAndUpdate's atomicity rather than read-then-write.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

module.exports = { Counter, getNextSequence };
