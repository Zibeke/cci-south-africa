const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 3000 },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date, default: null }
});

messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
module.exports = mongoose.model('Message', messageSchema);