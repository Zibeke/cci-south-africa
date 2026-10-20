const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

const contentBlockSchema = new mongoose.Schema({
  type: { type: String, enum: ['paragraph', 'subheading', 'image', 'link', 'bulletList', 'numberedList', 'quote', 'richText'], required: true },
  content: { type: String, default: '', maxlength: 12000 },
  headingLevel: { type: String, enum: ['h2', 'h3'], default: 'h2' },
  src: { type: String, default: '' },
  alt: { type: String, default: '', maxlength: 300 },
  caption: { type: String, default: '', maxlength: 500 },
  url: { type: String, default: '' },
  items: [{ type: String, maxlength: 2000 }],
  position: { type: Number, required: true }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 12000, default: '' },
  contentBlocks: { type: [contentBlockSchema], default: undefined },
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
  registrationUrl: { type: String, trim: true },
  status: { type: String, enum: ['draft', 'published'] },
  seedKey: { type: String, unique: true, sparse: true, select: false },
  createdAt: { type: Date, default: Date.now }
});

eventSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Event', eventSchema);
