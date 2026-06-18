const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Helper function to determine file type from mimetype
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, text, replyTo } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    // ✅ PROCESS UPLOADED FILES
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          type: getFileType(file.mimetype),
          url: `/uploads/${file.filename}`,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype
        });
      });
    }

    // Validate: Message must have either text or attachments
    if (!text && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message must have either text or attachments'
      });
    }

    // Find conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is participant
    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }

    // ✅ DETERMINE CONTENT TYPE
    let contentType = 'text';
    if (attachments.length > 0) {
      contentType = attachments[0].type; // Use first attachment's type
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user.id,
      content: {
        text: text || '',
        type: contentType
      },
      attachments: attachments,
      replyTo: replyTo || null
    });

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    // Populate sender details
    await message.populate('sender', 'name email profilePicture avatar');
    if (replyTo) {
      await message.populate('replyTo');
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get messages
    const messages = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: req.user.id }, // Exclude messages deleted by this user
      isDeleted: false // Exclude messages deleted for everyone
    })
    .populate('sender', 'name email profilePicture avatar')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedFor: { $ne: req.user.id },
      isDeleted: false
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Can't mark own message as read
    if (message.sender.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark own message as read'
      });
    }

    await message.markAsRead(req.user.id);

    // Update conversation's last read message
    const conversation = await Conversation.findById(message.conversation);
    if (conversation) {
      await conversation.updateParticipantSettings(req.user.id, {
        lastReadMessageId: message._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark message as delivered
// @route   PUT /api/messages/:id/delivered
// @access  Private
exports.markAsDelivered = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.markAsDelivered(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Message marked as delivered',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Private
exports.editMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    await message.editMessage(text);
    await message.populate('sender', 'name email profilePicture avatar');

    res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { deleteForEveryone } = req.query;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
      // User can only delete for themselves
      await message.deleteForUser(req.user.id);
      return res.status(200).json({
        success: true,
        message: 'Message deleted for you'
      });
    }

    // Sender can delete for everyone or just themselves
    if (deleteForEveryone === 'true') {
      await message.deleteMessage(true);
      res.status(200).json({
        success: true,
        message: 'Message deleted for everyone'
      });
    } else {
      await message.deleteForUser(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Message deleted for you'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add reaction to message
// @route   POST /api/messages/:id/reactions
// @access  Private
exports.addReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    await message.addReaction(req.user.id, emoji);

    res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove reaction from message
// @route   DELETE /api/messages/:id/reactions
// @access  Private
exports.removeReaction = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.removeReaction(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Reaction removed successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};