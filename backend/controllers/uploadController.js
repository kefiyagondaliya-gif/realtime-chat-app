const path = require('path');
const fs = require('fs').promises;
const { ErrorResponse } = require('../middleware/errorHandler');

/**
 * Upload Controller
 * Handles file uploads for profiles, chat attachments, etc.
 */

// @desc    Upload profile picture
// @route   POST /api/upload/profile-picture
// @access  Private
exports.uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    // Validate file type (should be image)
    if (!req.file.mimetype.startsWith('image/')) {
      // Delete uploaded file
      await fs.unlink(req.file.path);
      return next(new ErrorResponse('Please upload an image file', 400));
    }

    // Create file URL
    const fileUrl = `/uploads/profiles/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload avatar
// @route   POST /api/upload/avatar
// @access  Private
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    if (!req.file.mimetype.startsWith('image/')) {
      await fs.unlink(req.file.path);
      return next(new ErrorResponse('Please upload an image file', 400));
    }

    const fileUrl = `/uploads/profiles/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload group icon
// @route   POST /api/upload/group-icon
// @access  Private
exports.uploadGroupIcon = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    if (!req.file.mimetype.startsWith('image/')) {
      await fs.unlink(req.file.path);
      return next(new ErrorResponse('Please upload an image file', 400));
    }

    const fileUrl = `/uploads/groups/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Group icon uploaded successfully',
      data: {
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload chat attachments
// @route   POST /api/upload/chat-attachments
// @access  Private
exports.uploadChatAttachments = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new ErrorResponse('Please upload at least one file', 400));
    }

    const attachments = req.files.map(file => {
      let fileType = 'file';
      let folder = 'documents';

      if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
        folder = 'images';
      } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
        folder = 'videos';
      } else if (file.mimetype.startsWith('audio/')) {
        fileType = 'audio';
        folder = 'audio';
      }

      return {
        type: fileType,
        url: `/uploads/${folder}/${file.filename}`,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };
    });

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      count: attachments.length,
      data: attachments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete uploaded file
// @route   DELETE /api/upload/:filename
// @access  Private
exports.deleteFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { folder = 'documents' } = req.query;

    const filePath = path.join(__dirname, `../uploads/${folder}/${filename}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return next(new ErrorResponse('File not found', 404));
    }

    // Delete file
    await fs.unlink(filePath);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get file info
// @route   GET /api/upload/info/:filename
// @access  Private
exports.getFileInfo = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { folder = 'documents' } = req.query;

    const filePath = path.join(__dirname, `../uploads/${folder}/${filename}`);

    // Check if file exists and get stats
    try {
      const stats = await fs.stat(filePath);
      
      res.status(200).json({
        success: true,
        data: {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      });
    } catch (error) {
      return next(new ErrorResponse('File not found', 404));
    }
  } catch (error) {
    next(error);
  }
};