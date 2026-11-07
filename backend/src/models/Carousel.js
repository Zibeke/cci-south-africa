const mongoose = require('mongoose');

const carouselSchema = new mongoose.Schema({
  itemType: { type: String, enum: ['event', 'gallery', 'video'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  heading: { type: String, trim: true, default: '' },
  image: { type: String, default: '' },
  imageAsset: {
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' }
  },
  videoUrl: { type: String, default: '' },
  videoAsset: {
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video'], default: 'video' }
  },
  descriptionSnippet: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

carouselSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Carousel', carouselSchema);
