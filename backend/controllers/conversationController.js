const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');

// @desc    Create or get direct conversation
// @route   POST /api/conversations/direct
// @access  Private
exports.markAsRead = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const participant = conversation.participants.find(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (participant) {
      participant.unreadCount = 0;
    }
    conversation.participants.forEach((p) => {
      if (p.user.toString() !== senderId.toString()) {
        p.unreadCount += 1;
      }
    });
    await conversation.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createDirectConversation = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself'
      });
    }

    // Check if user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if direct conversation already exists
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      'participants.user': { $all: [currentUserId, userId] }
    }).populate('participants.user', 'name email profilePicture avatar status');

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        data: existingConversation
      });
    }

    // Create new direct conversation
    const conversation = await Conversation.create({
      type: 'direct',
      participants: [
        { user: currentUserId },
        { user: userId }
      ],
      createdBy: currentUserId
    });

    await conversation.populate('participants.user', 'name email profilePicture avatar status');

    res.status(201).json({
      success: true,
      message: 'Direct conversation created successfully',
      data: conversation
    });
  } catch (error) {
    next(error);
  }

};

// @desc    Create group conversation
// @route   POST /api/conversations/group
// @access  Private
exports.createGroupConversation = async (req, res, next) => {
  try {
    const { name, participantIds, description, groupIcon } = req.body;
    const currentUserId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    if (!participantIds || participantIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'At least one other participant is required'
      });
    }

    // Build participants array with current user as admin
    const participants = [
      { user: currentUserId, role: 'admin' }
    ];

    // Add other participants as members
    participantIds.forEach(id => {
      if (id !== currentUserId) {
        participants.push({ user: id, role: 'member' });
      }
    });

    const conversation = await Conversation.create({
      name,
      type: 'group',
      participants,
      description: description || '',
      groupIcon: groupIcon || null,
      createdBy: currentUserId
    });

    await conversation.populate('participants.user', 'name email profilePicture avatar status');

    res.status(201).json({
      success: true,
      message: 'Group conversation created successfully',
      data: conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all conversations for current user
// @route   GET /api/conversations
// @access  Private
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      'participants.user': userId
    })
      .populate('participants.user', 'name email profilePicture avatar status lastSeen')
      .populate('lastMessage')
      .populate('createdBy', 'name')
      .sort({ lastMessageAt: -1 });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.getParticipant(userId);

        return {
          ...conv.toObject(),
          unreadCount: participant?.unreadCount || 0,
          userSettings: {
            isPinned: participant?.isPinned || false,
            isArchived: participant?.isArchived || false,
            isMuted: participant?.isMuted || false
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: conversationsWithUnread.length,
      data: conversationsWithUnread
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get conversation by ID
// @route   GET /api/conversations/:id
// @access  Private
exports.getConversationById = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants.user', 'name email profilePicture avatar status lastSeen')
      .populate('lastMessage')
      .populate('createdBy', 'name');

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
        message: 'Access denied'
      });
    }

    const unreadCount = await conversation.getUnreadCount(req.user.id);
    const participant = conversation.getParticipant(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        ...conversation.toObject(),
        unreadCount,
        userSettings: {
          isPinned: participant?.isPinned || false,
          isArchived: participant?.isArchived || false,
          isMuted: participant?.isMuted || false
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update conversation settings (pin, archive, mute)
// @route   PUT /api/conversations/:id/settings
// @access  Private
exports.updateConversationSettings = async (req, res, next) => {
  try {
    const { isPinned, isArchived, isMuted } = req.body;
    const conversation = await Conversation.findById(req.params.id);

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

    const settings = {};
    if (isPinned !== undefined) settings.isPinned = isPinned;
    if (isArchived !== undefined) settings.isArchived = isArchived;
    if (isMuted !== undefined) settings.isMuted = isMuted;

    await conversation.updateParticipantSettings(req.user.id, settings);

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add participants to group conversation
// @route   POST /api/conversations/:id/participants
// @access  Private
exports.addParticipants = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Can only add participants to group conversations'
      });
    }

    // Check if current user is admin
    const currentParticipant = conversation.getParticipant(req.user.id);
    if (!currentParticipant || currentParticipant.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add participants'
      });
    }

    // Add each user
    for (const userId of userIds) {
      await conversation.addParticipant(userId);
    }

    await conversation.populate('participants.user', 'name email profilePicture avatar');

    res.status(200).json({
      success: true,
      message: 'Participants added successfully',
      data: conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Leave conversation
// @route   DELETE /api/conversations/:id/leave
// @access  Private
exports.leaveConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave direct conversations'
      });
    }

    await conversation.removeParticipant(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Left conversation successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};