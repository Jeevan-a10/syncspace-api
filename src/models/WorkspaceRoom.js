const mongoose = require('mongoose');

const WorkspaceRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-_]+$/, 'Room ID may only contain lowercase alphanumeric characters, dashes, and underscores'],
      minlength: [3, 'Room ID must be at least 3 characters'],
      maxlength: [40, 'Room ID cannot exceed 40 characters'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Workspace room name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    topic: {
      type: String,
      enum: {
        values: ['general', 'engineering', 'design', 'architecture', 'standup'],
        message: 'Topic must be one of: general, engineering, design, architecture, standup',
      },
      default: 'general',
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: 'anonymous',
    },
    maxParticipants: {
      type: Number,
      default: 50,
      min: [2, 'Minimum participants is 2'],
      max: [500, 'Maximum participants is 500'],
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    settings: {
      allowAnonymous: {
        type: Boolean,
        default: true,
      },
      readOnly: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.WorkspaceRoom || mongoose.model('WorkspaceRoom', WorkspaceRoomSchema);
