const mongoose = require('mongoose');

const RoomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      index: true,
      lowercase: true,
      trim: true,
    },
    sender: {
      type: String,
      required: [true, 'Sender name or ID is required'],
      trim: true,
      minlength: [1, 'Sender cannot be empty'],
      maxlength: [50, 'Sender cannot exceed 50 characters'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    messageType: {
      type: String,
      enum: ['chat', 'system', 'announcement'],
      default: 'chat',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.models.RoomMessage || mongoose.model('RoomMessage', RoomMessageSchema);
