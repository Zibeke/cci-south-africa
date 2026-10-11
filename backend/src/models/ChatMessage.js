const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  createdAt: { type: Date, default: Date.now }
});

chatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
chatMessageSchema.index({ receiverId: 1, status: 1 });
module.exports = mongoose.model('ChatMessage', chatMessageSchema);
