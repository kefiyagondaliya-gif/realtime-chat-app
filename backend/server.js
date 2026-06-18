const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
// const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/database');
const corsConfig = require('./config/cors');
const { initializeSocket } = require('./config/socket');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/validation');
const app = express();
const cors = require('cors')

// Load environment variables
dotenv.config();
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// // ✅ Serve uploaded files as static content
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB();

// Initialize express app

// Security middleware
app.use(helmet()); // Set security headers
// app.use(mongoSanitize()); // Prevent NoSQL injection

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use(corsConfig);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Sanitize input middleware
app.use(sanitizeInput);

// Rate limiting (apply to all routes)
app.use('/api/', apiLimiter);

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ChatFlow API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      conversations: '/api/conversations',
      messages: '/api/messages'
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Initialize Socket.IO for real-time features
initializeSocket(server);

module.exports = app;