const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const postSchema = new mongoose.Schema({
  kind: { type: String, enum: ['event', 'video', 'gallery'], required: true },
  heading: { type: String, trim: true, maxlength: 140, default: '' },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  media: [{ type: String, required: true }],
  carouselImage: { type: String, default: '' },
  showInCarousel: { type: Boolean, default: false },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comments: [commentSchema],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);