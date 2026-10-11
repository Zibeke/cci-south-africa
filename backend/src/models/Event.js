const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  image: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  type: { type: String, enum: ['event', 'video'], required: true, default: 'event' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
  hashtags: [{ type: String, trim: true }],
  isUpcoming: { type: Boolean, default: false },
  startsAt: { type: Date, default: null },
  location: { type: String, trim: true, default: '' },
  seedKey: { type: String, unique: true, sparse: true, select: false },
  createdAt: { type: Date, default: Date.now }
});

eventSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Event', eventSchema);
