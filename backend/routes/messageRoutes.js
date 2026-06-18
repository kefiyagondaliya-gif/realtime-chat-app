const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  markAsRead,
  markAsDelivered,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const {
  validateMessage,
  validateObjectId,
  validatePagination
} = require('../middleware/validation');
const { messageLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload'); // ✅ ADD THIS

router.use(protect);

// ✅ FIXED: upload.array runs BEFORE validateMessage so req.body is populated
router.post('/', messageLimiter, upload.array('attachments', 5), validateMessage, sendMessage);

router.get('/:conversationId', validateObjectId('conversationId'), validatePagination, getMessages);
router.put('/:id/read', validateObjectId('id'), markAsRead);
router.put('/:id/delivered', validateObjectId('id'), markAsDelivered);
router.put('/:id', validateObjectId('id'), editMessage);
router.delete('/:id', validateObjectId('id'), deleteMessage);
router.post('/:id/reactions', validateObjectId('id'), addReaction);
router.delete('/:id/reactions', validateObjectId('id'), removeReaction);

module.exports = router;