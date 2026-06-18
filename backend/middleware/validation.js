const { ErrorResponse } = require('./errorHandler');

// Validate user registration
const validateRegistration = (req, res, next) => {
  next();
};

// Validate login
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }
  next();
};

// ✅ FIXED: validateMessage now handles multipart/form-data correctly
const validateMessage = (req, res, next) => {
  // Guard: req.body may still be undefined in edge cases
  if (!req.body) {
    return next(new ErrorResponse('Request body is missing', 400));
  }

  const { conversationId, text } = req.body;

  // Check files from multer (req.files) OR text-based attachments (req.body.attachments)
  const hasFiles = req.files && req.files.length > 0;
  const hasBodyAttachments =
    req.body.attachments &&
    (Array.isArray(req.body.attachments)
      ? req.body.attachments.length > 0
      : true);

  if (!conversationId) {
    return next(new ErrorResponse('Conversation ID is required', 400));
  }

  if (!text && !hasFiles && !hasBodyAttachments) {
    return next(new ErrorResponse('Message must have text or attachments', 400));
  }

  next();
};

// Validate conversation creation
const validateConversation = (req, res, next) => {
  const { type, userId, participantIds, name } = req.body;

  if (type === 'direct' && !userId) {
    return next(new ErrorResponse('User ID is required for direct conversation', 400));
  }

  if (type === 'group') {
    if (!name) {
      return next(new ErrorResponse('Group name is required', 400));
    }
    if (!participantIds || participantIds.length < 1) {
      return next(new ErrorResponse('At least one participant is required', 400));
    }
  }

  next();
};

// Validate MongoDB ObjectId
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);

    if (!isValid) {
      return next(new ErrorResponse('Invalid ID format', 400));
    }

    next();
  };
};

// Validate pagination params
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;

  req.query.page = parseInt(page, 10);
  req.query.limit = parseInt(limit, 10);

  if (req.query.page < 1) req.query.page = 1;
  if (req.query.limit < 1 || req.query.limit > 100) req.query.limit = 50;

  next();
};

// Sanitize input (prevent NoSQL injection)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      });
    }
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateMessage,
  validateConversation,
  validateObjectId,
  validatePagination,
  sanitizeInput
};