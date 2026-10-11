const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  forAllUsers: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ forAllUsers: 1, userId: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
