const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * Prevents abuse and DDoS attacks
 */

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes'
  }
});

// Rate limiter for message sending
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 messages per minute
  message: {
    success: false,
    message: 'Too many messages sent, please slow down'
  }
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per 15 minutes
  message: {
    success: false,
    message: 'Too many file uploads, please try again later'
  }
});

// Rate limiter for search requests
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please slow down'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
  uploadLimiter,
  searchLimiter
};