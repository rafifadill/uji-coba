const express = require("express");
const router = express.Router();
const userController = require("../controllers/userControllers");
const upload = require("../middleware/upload"); // gunakan upload.js atau uploadMiddleware.js sesuai setup Anda
const { authMiddleware } = require("../middleware/authMiddleware");
const db = require('../models');
require("dotenv").config(); // Sesuaikan path-nya

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);
router.put("/:id/password", userController.changePassword); // Tambah ini
router.delete("/:id", userController.deleteUser);

// Upload foto profil user
router.post("/:id/photo", authMiddleware, upload.single("photo"), userController.uploadPhoto);

// Ambil riwayat pesanan user berdasarkan user id
router.get('/:id/history', async (req, res) => {
  try {
    const userId = req.params.id;
    // Ambil semua pesanan user
    const orders = await db.Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: db.Layanan,
          as: 'layanan', // sesuaikan alias dengan yang ada di model
        }
      ],
      order: [['order_date', 'DESC']]
    });
    // Format response
    const history = orders.map(order => ({
      id: order.id,
      car_name: order.layanan?.nama || order.layanan?.name || '-',
      start_date: order.pickup_date,
      end_date: order.return_date,
      status: order.status,
      total_price: order.total_price,
      order_date: order.order_date
    }));
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pesanan user', error: err.message });
  }
});

router.get('/admin/stats', async (req, res) => {
  const db = require('../models');
  try {
    const totalUsers = await db.User.count();
    const totalOrders = await db.Order.count();
    const totalRevenue = await db.Order.sum('total_price', { where: { payment_status: 'paid' } }) || 0;
    const totalCars = await db.Layanan.count();
    const pendingOrders = await db.Order.count({ where: { status: 'pending' } });
    const paidOrders = await db.Order.count({ where: { payment_status: 'paid' } });

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue,
      totalCars,
      pendingOrders,
      paidOrders
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
