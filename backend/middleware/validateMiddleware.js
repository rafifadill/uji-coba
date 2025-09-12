// middleware/validateMiddleware.js
const { validationResult } = require('express-validator');
const createHttpError = require('http-errors');

/**
 * Middleware untuk memvalidasi hasil dari express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validasi gagal',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * Middleware untuk memvalidasi ObjectId (MongoDB)
 */
const validateObjectId = (idName = 'id') => (req, res, next) => {
  const id = req.params[idName];
  
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'ID tidak valid'
    });
  }
  
  next();
};

/**
 * Middleware untuk memvalidasi body request tidak kosong
 */
const validateBodyNotEmpty = (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body tidak boleh kosong'
    });
  }
  
  next();
};

module.exports = {
  validate,
  validateObjectId,
  validateBodyNotEmpty
};