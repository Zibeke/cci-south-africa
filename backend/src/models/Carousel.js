const mongoose = require('mongoose');

const carouselSchema = new mongoose.Schema({
  itemType: { type: String, enum: ['event', 'gallery', 'video'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  heading: { type: String, trim: true, default: '' },
  image: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  descriptionSnippet: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

carouselSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Carousel', carouselSchema);
