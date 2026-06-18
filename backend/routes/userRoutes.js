const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  updateStatus,
  searchUsers,
  getUserById,
  logout
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateObjectId
} = require('../middleware/validation');
const { authLimiter, searchLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);

// Protected routes
router.use(protect);

router.get('/me', getMe);
router.put('/me', updateProfile);
router.put('/status', updateStatus);
router.post('/logout', logout);
router.get('/search', searchLimiter, searchUsers);
router.get('/:id', validateObjectId('id'), getUserById);

module.exports = router;