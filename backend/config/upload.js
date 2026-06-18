const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Multer Configuration for File Uploads
 * Handles profile pictures, chat attachments, etc.
 */

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;

    // Organize by file type
    if (file.fieldname === 'profilePicture' || file.fieldname === 'avatar') {
      uploadPath = path.join(uploadsDir, 'profiles');
    } else if (file.fieldname === 'groupIcon') {
      uploadPath = path.join(uploadsDir, 'groups');
    } else if (file.mimetype.startsWith('image/')) {
      uploadPath = path.join(uploadsDir, 'images');
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath = path.join(uploadsDir, 'videos');
    } else if (file.mimetype.startsWith('audio/')) {
      uploadPath = path.join(uploadsDir, 'audio');
    } else {
      uploadPath = path.join(uploadsDir, 'documents');
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

// File size limits (in bytes)
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB default
  files: 5 // Maximum 5 files at once
};

// Profile picture upload (single file, max 5MB)
const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('profilePicture');

// Avatar upload (single file, max 2MB)
const uploadAvatar = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
}).single('avatar');

// Group icon upload (single file, max 5MB)
const uploadGroupIcon = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('groupIcon');

// Chat attachments (multiple files, max 10MB each)
const uploadChatAttachments = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
}).array('attachments', 5);

// General file upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

module.exports = {
  upload,
  uploadProfilePicture,
  uploadAvatar,
  uploadGroupIcon,
  uploadChatAttachments
};