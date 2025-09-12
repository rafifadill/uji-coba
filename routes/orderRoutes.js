const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const upload = require('../middleware/upload');
const orderController = require("../controllers/orderController");
const { authMiddleware, checkAdmin } = require('../middleware/authMiddleware');

// Setup Multer untuk upload bukti pembayaran
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require("dotenv").config();
const uploadMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads/payment_proofs');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, or PDF files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Maks 5MB
  }
});

// Route yang TIDAK perlu auth (letakkan SEBELUM router.use(authMiddleware))
router.get(
  '/check-availability',
  orderController.checkCarAvailability
);

router.get(
  '/layanan/:id/booked-dates',
  orderController.getBookedDates
);

// Middleware auth global (setelah route di atas)
router.use(authMiddleware);

// Create order dengan bukti pembayaran opsional
router.post(
  '/',
  uploadMulter.single('payment_proof'),
  [
    check('layanan_id', 'Car ID is required').isInt(),
    check('pickup_date', 'Valid pickup date is required').isISO8601(),
    check('return_date', 'Valid return date is required').isISO8601(),
    check('payment_method', 'Invalid payment method')
      .optional()
      .isIn(['credit_card', 'bank_transfer', 'e_wallet']),
    check('total_price', 'Total price must be a number').optional().isFloat()
  ],
  orderController.createOrder
);

// Route untuk admin: melihat semua order
router.get(
  "/admin/all",
  authMiddleware,
  checkAdmin,
  orderController.getAllOrdersAdmin
);

// Upload bukti pembayaran untuk order yang sudah ada
router.put(
  '/:id/payment',
  uploadMulter.single('payment_proof'),
  [
    check('id', 'Invalid order ID').isInt()
  ],
  orderController.uploadPaymentProof
);

// Mendapatkan semua order dengan filter opsional
router.get(
  "/",
  [
    check('page', 'Page must be a positive integer').optional().isInt({ min: 1 }),
    check('limit', 'Limit must be a positive integer').optional().isInt({ min: 1 }),
    check('status', 'Invalid status').optional().isIn([
      'unpaid', 'pending', 'confirmed', 'completed', 'cancelled'
    ])
  ],
  orderController.getAllOrders
);

// Mendapatkan detail order berdasarkan ID
router.get(
  "/:id",
  [
    check("id", "Invalid order ID").isInt()
  ],
  orderController.getOrderById
);

// Ambil semua pesanan berdasarkan user_id (khusus admin)
router.get(
  "/user/:user_id",
  checkAdmin,
  orderController.getOrderByUserId
);

// Verifikasi pembayaran oleh admin
router.put(
  '/:id/verify',
  [
    check('id', 'Invalid order ID').isInt(),
    check('status', 'Invalid verification status').isIn(['paid', 'rejected'])
  ],
  orderController.verifyPayment
);

// Batalkan order
router.put(
  '/:id/cancel',
  [
    check('id', 'Invalid order ID').isInt()
  ],
  orderController.cancelOrder
);

// Update order status
router.put(
  '/:id',
  [
    check('id', 'Invalid order ID').isInt(),
    check('status', 'Invalid status').isIn(['pending', 'confirmed', 'completed', 'cancelled', 'rejected'])
  ],
  orderController.updateOrderStatus
);

// Generate receipt
router.get(
  '/:id/receipt',
  authMiddleware,
  [
    check('id', 'Invalid order ID').isInt()
  ],
  orderController.getOrderReceipt
);

// Hapus order
router.delete(
  '/:id',
  authMiddleware,
  checkAdmin,
  orderController.deleteOrder
);

// Contoh penggunaan:
router.post(
  '/:id/upload-payment',
  upload.single('payment_proof'),
  [
    check('some_field').notEmpty().withMessage('Field wajib diisi')
  ],
  orderController.uploadPaymentProof
);

router.post("/add-to-calendar", authMiddleware, orderController.addToCalendar);

// Route dinamis (harus di bawah)
router.get(
  "/:id",
  [
    check("id", "Invalid order ID").isInt()
  ],
  orderController.getOrderById
);

module.exports = router;
