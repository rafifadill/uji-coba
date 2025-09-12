const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/midtrans', authMiddleware, paymentController.createPayment);
router.post('/midtrans-token', authMiddleware, paymentController.createMidtransToken);
router.post('/midtrans-callback', paymentController.handleMidtransCallback);

module.exports = router;