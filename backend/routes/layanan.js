const express = require('express');
const router = express.Router();
const Layanan = require('../controllers/layanan');
const upload = require('../middleware/upload');
const { Order } = require('../models'); // pastikan path model benar
const { Op } = require('sequelize');
const layananController = require('../controllers/layanan');

// Endpoint kalender ketersediaan mobil
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await Order.findAll({
      where: {
        layanan_id: id,
        status: { [Op.notIn]: ['cancelled', 'completed'] }
      }
    });
    const bookedDates = orders.map(order => ({
      start: order.pickup_date,
      end: order.return_date
    }));
    res.json({ bookedDates });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data ketersediaan', error: err.message });
  }
});

// Route bawaan
router.get('/', Layanan.getAll);
router.get('/:id', Layanan.getById);
router.post('/', upload.single('gambar'), Layanan.create);
router.put('/:id', upload.single('gambar'), Layanan.update);
router.delete('/:id', Layanan.delete);
router.get('/available', Layanan.getAvailable);
router.get('/omzet', layananController.getOmzetLayanan);

module.exports = router;
