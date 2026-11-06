const mongoose = require('mongoose');

const ChangeRecordSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    author: { type: String, required: true, default: 'anonymous' },
    timestamp: { type: Date, default: Date.now },
    changeType: {
      type: String,
      enum: ['init', 'edit', 'replace', 'reset'],
      default: 'edit',
    },
    deltaLength: { type: Number, default: 0 },
  },
  { _id: false }
);

const CollaborativeDocSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [120, 'Document title cannot exceed 120 characters'],
      default: 'Untitled Workspace Document',
    },
    content: {
      type: String,
      default: '# Welcome to SyncSpace\n\nStart typing collaboratively in real time...',
    },
    version: {
      type: Number,
      default: 1,
      min: [1, 'Version must be at least 1'],
    },
    lastModifiedBy: {
      type: String,
      default: 'system',
      trim: true,
    },
    changeHistory: {
      type: [ChangeRecordSchema],
      default: () => [
        {
          version: 1,
          author: 'system',
          timestamp: new Date(),
          changeType: 'init',
          deltaLength: 0,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Method to record revision history
CollaborativeDocSchema.methods.applyRevision = function (newContent, author = 'anonymous', changeType = 'edit') {
  const prevLength = (this.content || '').length;
  const newLength = (newContent || '').length;
  this.content = newContent;
  this.version += 1;
  this.lastModifiedBy = author;

  this.changeHistory.push({
    version: this.version,
    author,
    timestamp: new Date(),
    changeType,
    deltaLength: newLength - prevLength,
  });

  // Keep last 100 revision history records to avoid unbounded growth
  if (this.changeHistory.length > 100) {
    this.changeHistory = this.changeHistory.slice(-100);
  }

  return this;
};

module.exports = mongoose.models.CollaborativeDoc || mongoose.model('CollaborativeDoc', CollaborativeDocSchema);
