const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Conversation name cannot exceed 100 characters'],
    // Required only for group chats
    required: function () {
      return this.type === 'group';
    }
  },
  type: {
    type: String,
    enum: {
      values: ['direct', 'group'],
      message: 'Type must be either direct or group'
    },
    required: [true, 'Conversation type is required'],
    default: 'direct'
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    // User-specific settings
    isPinned: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  }],
  groupIcon: {
    type: String,
    default: null // URL or path to group icon
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ 'participants.user': 1, 'participants.isPinned': 1 });

// Validation: Direct chat must have exactly 2 participants
conversationSchema.pre('save', function () {
  if (this.type === 'direct' && this.participants.length !== 2) {
    throw new Error('Direct conversation must have exactly 2 participants');
  }

  if (this.type === 'group' && this.participants.length < 2) {
    throw new Error('Group conversation must have at least 2 participants');
  }
});

// Method to check if user is participant
conversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some(p => p.user.toString() === userId.toString());
};

// Method to get participant by user ID
conversationSchema.methods.getParticipant = function (userId) {
  return this.participants.find(p => p.user.toString() === userId.toString());
};

// Method to add participant (for group chats)
conversationSchema.methods.addParticipant = async function (userId, role = 'member') {
  if (this.type === 'direct') {
    throw new Error('Cannot add participants to direct conversation');
  }

  if (this.isParticipant(userId)) {
    throw new Error('User is already a participant');
  }

  this.participants.push({
    user: userId,
    role: role,
    joinedAt: Date.now()
  });

  await this.save();
  return this;
};

// Method to remove participant (for group chats)
conversationSchema.methods.removeParticipant = async function (userId) {
  if (this.type === 'direct') {
    throw new Error('Cannot remove participants from direct conversation');
  }

  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );

  await this.save();
  return this;
};

// Method to update participant settings
conversationSchema.methods.updateParticipantSettings = async function (userId, settings) {
  const participant = this.getParticipant(userId);

  if (!participant) {
    throw new Error('User is not a participant in this conversation');
  }

  Object.assign(participant, settings);
  await this.save();
  return this;
};

// Method to get unread count for a user
conversationSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model('Message');
  const participant = this.getParticipant(userId);

  if (!participant || !participant.lastReadMessageId) {
    // Count all messages in conversation
    return await Message.countDocuments({
      conversation: this._id,
      sender: { $ne: userId }
    });
  }

  // Count messages after last read
  const lastReadMessage = await Message.findById(participant.lastReadMessageId);
  if (!lastReadMessage) {
    return 0;
  }

  return await Message.countDocuments({
    conversation: this._id,
    sender: { $ne: userId },
    createdAt: { $gt: lastReadMessage.createdAt }
  });
};

// Virtual to populate messages
conversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversation'
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;