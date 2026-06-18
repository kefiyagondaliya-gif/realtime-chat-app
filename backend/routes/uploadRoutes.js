const express = require('express');
const router = express.Router();
const {
  uploadProfilePicture,
  uploadAvatar,
  uploadGroupIcon,
  uploadChatAttachments,
  deleteFile,
  getFileInfo
} = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const {
  uploadProfilePicture: uploadProfileMiddleware,
  uploadAvatar: uploadAvatarMiddleware,
  uploadGroupIcon: uploadGroupIconMiddleware,
  uploadChatAttachments: uploadChatAttachmentsMiddleware
} = require('../config/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// Apply rate limiting to all upload routes
router.use(uploadLimiter);

router.post('/profile-picture', uploadProfileMiddleware, uploadProfilePicture);
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);
router.post('/group-icon', uploadGroupIconMiddleware, uploadGroupIcon);
router.post('/chat-attachments', uploadChatAttachmentsMiddleware, uploadChatAttachments);
router.delete('/:filename', deleteFile);
router.get('/info/:filename', getFileInfo);

module.exports = router;