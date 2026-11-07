const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  heading: { type: String, required: true, trim: true, maxlength: 140 },
  carouselImage: { type: String, default: '' },
  carouselImageAsset: {
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' }
  },
  galleryImages: {
    type: [{ type: String, required: true }],
    validate: {
      validator: (images) => images.length <= 500,
      message: 'A gallery can contain at most 500 images.'
    }
  },
  galleryImageAssets: [{
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video'], required: true }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

gallerySchema.index({ createdAt: -1 });
module.exports = mongoose.model('Gallery', gallerySchema);
