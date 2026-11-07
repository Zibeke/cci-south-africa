const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  relatedType: { type: String, enum: ['event', 'gallery'], default: null },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const postSchema = new mongoose.Schema({
  kind: { type: String, enum: ['event', 'video', 'gallery'], required: true },
  heading: { type: String, trim: true, maxlength: 140, default: '' },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  media: [{ type: String, required: true }],
  mediaAssets: [{
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video'], required: true }
  }],
  carouselImage: { type: String, default: '' },
  carouselImageAsset: {
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' }
  },
  showInCarousel: { type: Boolean, default: false },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comments: [commentSchema],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);