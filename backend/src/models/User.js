const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  passwordHash: { type: String, default: '' },
  sessionVersion: { type: Number, default: 0 },
  photo: { type: String, default: '' },
  photoAsset: {
    publicId: { type: String, default: '' },
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' }
  },
  authProvider: { type: String, enum: ['local', 'microsoft'], default: 'local' },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);