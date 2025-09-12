const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

router.post('/send-wa', auth, notificationController.sendWhatsapp);
router.get('/', auth, notificationController.getAll);
router.put('/:id/read', auth, notificationController.markAsRead);
router.put('/read-all', auth, notificationController.markAllAsRead);
router.post('/blast', auth, notificationController.blast);
router.delete('/', auth, notificationController.deleteAll); // Hapus semua notifikasi
router.delete('/:id', auth, notificationController.deleteOne); // Hapus satu notifikasi

module.exports = router;