const express = require('express');
const router = express.Router();
const testimoniController = require('../controllers/testimoni');

// Debug: Cek apakah fungsi terdaftar
console.log('Controller functions:', Object.keys(testimoniController));

router.get('/', testimoniController.getAllTestimoni);
router.post('/', testimoniController.addTestimoni);
router.delete('/:id', testimoniController.deleteTestimoni);
router.put('/:id/reply', testimoniController.reply);

module.exports = router;