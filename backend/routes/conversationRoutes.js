const express = require('express');
const router = express.Router();
const {
  createDirectConversation,
  createGroupConversation,
  getConversations,
  getConversationById,
  updateConversationSettings,
  addParticipants,
  leaveConversation,
  markAsRead
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// All routes require authentication
router.use(protect);

router.post('/direct', createDirectConversation);
router.post('/group', createGroupConversation);
router.put("/read/:conversationId", protect, markAsRead);
router.get('/', getConversations);
router.get('/:id', validateObjectId('id'), getConversationById);
router.put('/:id/settings', validateObjectId('id'), updateConversationSettings);
router.post('/:id/participants', validateObjectId('id'), addParticipants);
router.delete('/:id/leave', validateObjectId('id'), leaveConversation);

module.exports = router;