const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create memory storage (more reliable with Node.js v23+)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, or PDF allowed'), false);
  }
  cb(null, true);
};

// Create the multer instance
const multerUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Create middleware functions
const uploadSingle = multerUpload.single('payment_proof');
const uploadMiddleware = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({ 
        success: false,
        message: err.message 
      });
    }
    next();
  });
};

module.exports = uploadMiddleware;