const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Conversation is required']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  content: {
    text: {
      type: String,
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters']
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video'],
      default: 'text'
    }
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'audio', 'video']
    },
    url: String,
    filename: String,
    size: Number, // in bytes
    mimeType: String
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // Users who deleted this message for themselves
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

// Indexes for better performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'readBy.user': 1 });

// Validation: Message must have either text or attachments
messageSchema.pre('save', function() {
  if (!this.content.text && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error('Message must have either text or attachments'));
  }
});

// Method to mark as read by user
messageSchema.methods.markAsRead = async function(userId) {
  // Check if already read
  const alreadyRead = this.readBy.some(r => r.user.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({
      user: userId,
      readAt: Date.now()
    });
    await this.save();
  }
  
  return this;
};

// Method to mark as delivered to user
messageSchema.methods.markAsDelivered = async function(userId) {
  // Check if already delivered
  const alreadyDelivered = this.deliveredTo.some(d => d.user.toString() === userId.toString());
  
  if (!alreadyDelivered) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: Date.now()
    });
    await this.save();
  }
  
  return this;
};

// Method to add reaction
messageSchema.methods.addReaction = async function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    createdAt: Date.now()
  });
  
  await this.save();
  return this;
};

// Method to remove reaction
messageSchema.methods.removeReaction = async function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  await this.save();
  return this;
};

// Method to edit message
messageSchema.methods.editMessage = async function(newText) {
  this.content.text = newText;
  this.isEdited = true;
  this.editedAt = Date.now();
  await this.save();
  return this;
};

// Method to delete message (soft delete)
messageSchema.methods.deleteMessage = async function(deleteForEveryone = false) {
  if (deleteForEveryone) {
    this.isDeleted = true;
    this.deletedAt = Date.now();
  }
  await this.save();
  return this;
};

// Method to delete for specific user
messageSchema.methods.deleteForUser = async function(userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
    await this.save();
  }
  return this;
};

// Check if message is read by user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(r => r.user.toString() === userId.toString());
};

// Check if message is delivered to user
messageSchema.methods.isDeliveredTo = function(userId) {
  return this.deliveredTo.some(d => d.user.toString() === userId.toString());
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;