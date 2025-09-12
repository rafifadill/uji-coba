const { Op } = require("sequelize");
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sequelize = require("../config/database");
const db = require('../models');
const Notification = db.Notification;
const { Order, Layanan, User } = db;
const { sendMail } = require("../utils/email");
const { sendWhatsappFonnte } = require("../utils/whatsapp"); // pastikan sudah ada
const Testimoni = require('../models/testimoni'); // pastikan sudah di-import
const { io } = require('../utils/socket'); // pastikan ada file socket.js yang export io

// Helper
const calculateRentalDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const hitungDurasiSewa = (tanggalMulai, tanggalSelesai) => {
  const diffTime = Math.abs(new Date(tanggalSelesai) - new Date(tanggalMulai));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const deleteFileIfExist = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Multer config
const storage = multer.diskStorage({
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
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, or PDF are allowed.'), false);
  }
};
exports.upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Format response order
function formatResponOrder(order, car, durasi) {
  return {
    id: order.id,
    order_date: order.order_date,
    pickup_date: order.pickup_date,
    return_date: order.return_date,
    duration: durasi,
    total_price: order.total_price,
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    payment_proof: order.payment_proof ? `/uploads/payment_proofs/${path.basename(order.payment_proof)}` : null,
    additional_notes: order.additional_notes,
    car: {
      id: car.id,
      name: car.nama || "-",
      license_plate: car.nomor_plat || "-",
      image_url: car.gambar || "/images/default-car.jpg",
      type: car.type || "Standard",
      transmission: car.transmisi || car.transmission || "Automatic",
      fuel_type: car.fuel_type || car.fuel || "Gasoline",
      capacity: car.kapasitas || car.capacity || 4,
      price_per_day: car.harga_per_hari || car.harga || 0,
      promo: car.promo || 0,
      rating: car.rating !== undefined ? car.rating : null,
      jumlah_review: car.jumlah_review || 0,
      fitur: car.fitur || []
    }
  };
};

const cekKetersediaanMobil = async (carId, pickupDate, returnDate, transaction) => {
  const orderConflicts = await Order.findAll({
    where: {
      layanan_id: carId,
      [Op.or]: [
        {
          pickup_date: { [Op.lte]: returnDate },
          return_date: { [Op.gte]: pickupDate },
        },
      ],
      status: { [Op.notIn]: ["cancelled", "completed"] },
    },
    transaction,
  });
  return orderConflicts.length === 0;
};

async function getCarWithRating(car) {
  // Ambil semua testimoni untuk layanan ini
  const testimoni = await Testimoni.findAll({ where: { layanan_id: car.id } });
  let rating = 0;
  let jumlah_review = 0;
  if (testimoni.length > 0) {
    jumlah_review = testimoni.length;
    rating = testimoni.reduce((sum, t) => sum + t.rating, 0) / jumlah_review;
    rating = Math.round(rating * 10) / 10; // 1 desimal
  }
  return {
    id: car.id,
    name: car.nama || "-",
    license_plate: car.nomor_plat || "-",
    image_url: car.gambar || "/images/default-car.jpg",
    type: car.type || "Standard",
    transmission: car.transmisi || car.transmission || "Automatic",
    fuel_type: car.fuel_type || car.fuel || "Gasoline",
    capacity: car.kapasitas || car.capacity || 4,
    price_per_day: car.harga_per_hari || car.harga || 0,
    promo: car.promo || 0,
    rating,
    jumlah_review,
    fitur: car.fitur || []
  };
}

// ========== CONTROLLER FUNCTIONS ==========

exports.createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  let car;
  try {
    // Ambil dari req.body
    const {
      layanan_id,
      pickup_date,
      return_date,
      payment_method,
      additional_notes,
      total_price,
      payment_status,
      midtrans_order_id
    } = req.body;

    // Validasi input
    if (!layanan_id || !pickup_date || !return_date) {
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(400).json({
        success: false,
        message: "Data yang diperlukan tidak lengkap"
      });
    }

    const pickupDate = new Date(pickup_date);
    const returnDate = new Date(return_date);

    // Cek ketersediaan mobil
    const isAvailable = await cekKetersediaanMobil(layanan_id, pickupDate, returnDate, transaction);
    if (!isAvailable) {
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(400).json({
        success: false,
        message: "Mobil tidak tersedia untuk tanggal yang dipilih"
      });
    }

    // Buat pesanan
    const newOrder = await Order.create({
      user_id: req.user.id,
      layanan_id,
      order_date: new Date(),
      pickup_date,
      return_date,
      total_price,
      payment_method: payment_method || "midtrans",
      payment_status: payment_status || "unpaid",
      midtrans_order_id: midtrans_order_id || null,
      additional_notes: additional_notes || null,
      status: payment_status === "paid" ? "confirmed" : payment_status === "failed" ? "cancelled" : "pending"
    }, { transaction });

    // Ambil data mobil
    car = await Layanan.findByPk(layanan_id);

    // Simpan notifikasi ke database
    await Notification.create({
      user_id: null,
      message: `Pesanan baru dari ${req.user.name} untuk ${car?.nama || 'mobil'}.`,
      type: 'order'
    });
    // Emit ke admin (atau broadcast)
    req.app.get('io').emit('new_order', {
      title: 'Pesanan Baru',
      message: `Pesanan baru dari ${req.user.name} untuk ${car?.nama || 'mobil'}.`,
      type: 'order',
      createdAt: new Date().toISOString(),
      read: false
    });

    await transaction.commit();

    // --- NOTIFIKASI EMAIL & WHATSAPP ---
    // Ambil data user & mobil
    const user = await User.findByPk(req.user.id);

    // Email ke admin
    await sendMail({
      to: "rentalhs591@gmail.com",
      subject: `Pesanan Baru #${newOrder.id} dari ${user.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
          <div style="background:#1976d2; color:#fff; padding:24px;">
            <h2 style="margin:0; font-size:1.3rem;">🚗 Pesanan Baru Masuk</h2>
          </div>
          <div style="padding:28px 24px;">
            <p style="margin-bottom:16px;">Halo Admin,</p>
            <p style="margin-bottom:18px;">Ada pesanan baru yang perlu diproses. Berikut detailnya:</p>
            <table style="width:100%; font-size:1rem; margin-bottom:18px;">
              <tr>
                <td style="padding:6px 0; color:#555;">ID Pesanan</td>
                <td style="padding:6px 0;"><b>#${newOrder.id}</b></td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Nama Pelanggan</td>
                <td style="padding:6px 0;">${user.name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Email Pelanggan</td>
                <td style="padding:6px 0;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Tanggal Sewa</td>
                <td style="padding:6px 0;">${pickup_date} s/d ${return_date}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Mobil</td>
                <td style="padding:6px 0;">${car?.nama || "-"}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Total</td>
                <td style="padding:6px 0;"><b>Rp${Number(total_price).toLocaleString("id-ID")}</b></td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Metode Pembayaran</td>
                <td style="padding:6px 0;">${payment_method}</td>
              </tr>
            </table>
            <div style="margin:18px 0;">
              <a href="http://localhost:3001/admin/orders" style="display:inline-block; background:#1976d2; color:#fff; text-decoration:none; padding:10px 22px; border-radius:5px; font-weight:600;">Lihat di Dashboard Admin</a>
            </div>
            <p style="color:#888; font-size:0.97rem; margin-top:24px;">Segera proses pesanan ini agar pelanggan mendapatkan pelayanan terbaik.</p>
          </div>
          <div style="background:#f8f9fa; color:#888; text-align:center; font-size:0.95rem; padding:12px 0;">
            Rental Mobil &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    });

    // Email ke user
    await sendMail({
      to: user.email,
      subject: `Pesanan Anda Berhasil Dibuat (#${newOrder.id})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
          <div style="background:#1976d2; color:#fff; padding:24px;">
            <h2 style="margin:0; font-size:1.2rem;">Terima Kasih, Pesanan Anda Berhasil!</h2>
          </div>
          <div style="padding:28px 24px;">
            <p style="margin-bottom:10px;">Halo <b>${user.name}</b>,</p>
            <p style="margin-bottom:18px;">Pesanan Anda telah berhasil dibuat. Berikut detail pesanan Anda:</p>
            <table style="width:100%; font-size:1rem; margin-bottom:18px;">
              <tr>
                <td style="padding:6px 0; color:#555;">ID Pesanan</td>
                <td style="padding:6px 0;"><b>#${newOrder.id}</b></td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Tanggal Sewa</td>
                <td style="padding:6px 0;">${pickup_date} s/d ${return_date}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Mobil</td>
                <td style="padding:6px 0;">${car?.nama || "-"}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Total</td>
                <td style="padding:6px 0;"><b>Rp${Number(total_price).toLocaleString("id-ID")}</b></td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#555;">Metode Pembayaran</td>
                <td style="padding:6px 0;">${payment_method}</td>
              </tr>
            </table>
            <div style="background:#e3f2fd; border-radius:6px; padding:14px 18px; margin-bottom:18px; color:#1976d2;">
              <b>Catatan:</b> Mohon segera lakukan pembayaran sesuai metode yang dipilih.<br>
              Status pesanan dan pembayaran dapat dipantau melalui dashboard akun Anda.
            </div>
            <div style="margin:18px 0;">
              <a href="http://localhost:3000/orders" style="display:inline-block; background:#1976d2; color:#fff; text-decoration:none; padding:10px 22px; border-radius:5px; font-weight:600;">Lihat Pesanan Saya</a>
            </div>
            <p style="color:#888; font-size:0.97rem; margin-top:24px;">Jika ada pertanyaan, silakan hubungi admin melalui kontak yang tersedia di website.</p>
          </div>
          <div style="background:#f8f9fa; color:#888; text-align:center; font-size:0.95rem; padding:12px 0;">
            Rental Mobil &copy; ${new Date().getFullYear()}
          </div>
        </div>
      `,
    });

    // WhatsApp ke admin
    if (process.env.ADMIN_WA) {
      await sendWhatsappFonnte(
        process.env.ADMIN_WA,
        `🚗 Pesanan Baru Masuk!\n\nID Pesanan: #${newOrder.id}\nNama Pelanggan: ${user.name}\nTanggal Sewa: ${pickupDate.toLocaleDateString("id-ID")} s/d ${returnDate.toLocaleDateString("id-ID")}\nMobil: ${car?.nama || "-"}\nTotal: Rp${Number(total_price).toLocaleString("id-ID")}\n\nSegera proses pesanan ini di dashboard admin.`
      );
    }

    // WhatsApp ke user
    if (user.no_telp) {
      await sendWhatsappFonnte(
        user.no_telp,
        `✅ Pesanan Anda Berhasil!\n\nTerima kasih, ${user.name}.\nPesanan Anda (#${newOrder.id}) telah diterima.\n\nDetail Pesanan:\nMobil: ${car?.nama || "-"}\nTanggal Sewa: ${pickupDate.toLocaleDateString("id-ID")} s/d ${returnDate.toLocaleDateString("id-ID")}\nTotal: Rp${Number(total_price).toLocaleString("id-ID")}\n\nKami akan segera memproses pesanan Anda.\nCek status pesanan di website atau hubungi admin jika ada pertanyaan.`
      );
    }

    // Setelah pesanan baru dibuat atau pembayaran diverifikasi:
    const io = req.app.get("io");
    io.emit("new_notification", {
      type: "order",
      message: `Pesanan baru #${newOrder.id} dari ${user.name}`,
      time: new Date()
    });

    // Kirim reminder pembayaran jika belum bayar
    if ((payment_status || "unpaid") !== "paid") {
      await sendPaymentReminder(newOrder, user, car);
    }

    // Kirim response
    return res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat",
      data: { id: newOrder.id }
    });
  } catch (error) {
    if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
      await transaction.rollback();
    }
    console.error("Error membuat pesanan:", error, {
      body: req.body
    });
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message
    });
  }
};

exports.uploadPaymentProof = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada file yang diupload"
      });
    }

    const order = await Order.findOne({
      where: { id, user_id },
      transaction
    });

    if (!order) {
      deleteFileIfExist(req.file?.path);
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan"
      });
    }

    // Only allow upload if status is unpaid
    if (order.payment_status !== 'unpaid') {
      deleteFileIfExist(req.file?.path);
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(400).json({
        success: false,
        message: "Bukti pembayaran hanya bisa diupload untuk pesanan yang belum dibayar"
      });
    }

    // Hapus file lama jika ada
    deleteFileIfExist(order.payment_proof);

    await order.update({
      payment_proof: req.file.path,
      payment_status: 'pending_verification',
      status: 'pending'
    }, { transaction });

    const car = await Layanan.findByPk(order.layanan_id, { transaction });
    const durasi = hitungDurasiSewa(order.pickup_date, order.return_date);

    await transaction.commit();

    return res.json({
      success: true,
      message: "Bukti pembayaran berhasil diupload",
      data: formatResponOrder(order, car, durasi)
    });

  } catch (error) {
    if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
      await transaction.rollback();
    }
    deleteFileIfExist(req.file?.path);

    console.error("Error upload bukti pembayaran:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengupload bukti pembayaran"
    });
  }
};

exports.verifyPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status } = req.body; // 'paid' or 'rejected'

    if (!['paid', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status pembayaran tidak valid"
      });
    }

    const order = await Order.findOne({
      where: { id },
      transaction
    });

    if (!order) {
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan"
      });
    }

    // Only allow verification if status is pending_verification
    if (order.payment_status !== 'pending_verification') {
      if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
        await transaction.rollback();
      }
      return res.status(400).json({
        success: false,
        message: "Hanya pesanan dengan status pending_verification yang bisa diverifikasi"
      });
    }

    await order.update({
      payment_status: status,
      status: status === 'paid' ? 'confirmed' : 'cancelled'
    }, { transaction });
    // Trigger notifikasi user
    await Notification.create({
      user_id: order.user_id,
      message: `Pembayaran pesanan #${order.id} telah ${status === 'paid' ? 'diterima' : 'ditolak'}`,
      type: 'payment'
    });

    const car = await Layanan.findByPk(order.layanan_id, { transaction });
    const durasi = hitungDurasiSewa(order.pickup_date, order.return_date);

    await transaction.commit();

    // Kirim email ke user
    if (order.user_id) {
      const user = await User.findByPk(order.user_id);
      if (user && user.email) {
        await sendMail({
          to: user.email,
          subject: `Status Pembayaran Pesanan #${order.id}`,
          html: `
            <div style="font-family: Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2>Status Pembayaran Pesanan Anda</h2>
              <p>Halo <b>${user.name}</b>,</p>
              <p>Pembayaran pesanan Anda untuk mobil <b>${car?.nama || "-"}</b> telah <b>${status === 'paid' ? 'DITERIMA' : 'DITOLAK'}</b>.</p>
              <p>ID Pesanan: <b>#${order.id}</b></p>
              <p>Terima kasih telah menggunakan layanan kami.</p>
            </div>
          `
        });
      }
    }

    // Setelah pembayaran diverifikasi
    const io = req.app.get("io");
    io.emit("new_notification", {
      type: "payment",
      message: `Pembayaran pesanan #${order.id} telah diverifikasi`,
      time: new Date()
    });

    return res.json({
      success: true,
      message: `Status pembayaran berhasil diupdate menjadi ${status}`,
      data: formatResponOrder(order, car, durasi)
    });

  } catch (error) {
    if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
      await transaction.rollback();
    }
    console.error("Error verifikasi pembayaran:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memverifikasi pembayaran"
    });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: req.user.id };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Layanan,
          as: 'layanan',
          attributes: [
            'id', 'nama', 'harga', 'gambar', 'deskripsi', 'kategori', 'status',
            'promo', 'rating', 'jumlah_review', 'transmisi', 'kapasitas', 'fitur'
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const formattedOrders = orders.map(order => {
      const durasi = hitungDurasiSewa(order.pickup_date, order.return_date);
      return formatResponOrder(order, order.layanan, durasi);
    });

    return res.json({
      success: true,
      data: formattedOrders,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error mengambil pesanan:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil pesanan",
    });
  }
};

exports.getOrderByUserId = async (req, res) => {
  try {
    const user_id = req.params.user_id;

    const orders = await Order.findAll({
      where: { user_id },
      include: [
        {
          model: Layanan,
          as: 'layanan',
          attributes: ['id', 'nama', 'harga']
        },
        {
          model: User,
          as: 'user',
          attributes: ['name', 'no_telp']
        }
      ],
      order: [['order_date', 'DESC']]
    });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan untuk pengguna ini"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Daftar pesanan ditemukan",
      data: orders
    });

  } catch (error) {
    console.error("Error mengambil pesanan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};


exports.getOrderById = async (req, res) => {
  try {
    // Admin bisa akses semua, user hanya miliknya sendiri
    const where = { id: req.params.id };
    if (req.user.role !== "admin") {
      where.user_id = req.user.id;
    }

    const order = await Order.findOne({
      where,
      include: [
        {
          model: Layanan,
          as: 'layanan',
          attributes: ['id', 'nama', 'harga']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'no_telp']
        }
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan",
      });
    }

    // Kirim path bukti pembayaran yang bisa diakses frontend
    const paymentProofUrl = order.payment_proof
      ? `/uploads/payment_proofs/${require('path').basename(order.payment_proof)}`
      : null;

    return res.json({
      success: true,
      data: {
        ...order.toJSON(),
        payment_proof: paymentProofUrl
      }
    });
  } catch (error) {
    console.error("Error mengambil pesanan:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil detail pesanan",
    });
  }
};

// Fungsi untuk format response pesanan
const formatReceiptResponse = (order, car, user) => {
  const duration = calculateRentalDuration(order.pickup_date, order.return_date);
  return {
    order: {
      id: order.id,
      order_date: order.order_date,
      pickup_date: order.pickup_date,
      return_date: order.return_date,
      duration: duration,
      total_price: order.total_price,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      payment_proof: order.payment_proof ? `/uploads/payment_proofs/${path.basename(order.payment_proof)}` : null,
      additional_notes: order.additional_notes
    },
    car: {
      id: car.id,
      name: car.nama || `${car.merek || ""} ${car.model || ""}`,
      license_plate: car.nomor_plat || "-",
      image_url: car.image || "/images/default-car.jpg",
      type: car.type || "Standard",
      transmission: car.transmission || "Automatic",
      fuel_type: car.fuel || "Gasoline",
      capacity: car.kapasitas || 4,
      price_per_day: car.harga_per_hari || car.harga || 0
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email || "-",
      phone: user.phone || user.no_telp || "-",
      id_number: user.id_number || "-",
      address: user.address || "-"
    }
  };
};


// Fungsi untuk mendapatkan struk pesanan
exports.getOrderReceipt = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id },
      include: [
        { model: Layanan, as: 'layanan' },
        { model: User, as: 'user' }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const response = formatReceiptResponse(order, order.layanan, order.user);

    return res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error("Error getOrderReceipt:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// Fungsi lainnya yang sudah ada
exports.cancelOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const order = await Order.findOne({
      where: { id, user_id },
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan"
      });
    }

    // Hanya bisa cancel jika status masih unpaid/pending
    if (!['unpaid', 'pending'].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pesanan hanya bisa dibatalkan jika status unpaid/pending"
      });
    }

    await order.update({
      status: 'cancelled',
      payment_status: 'refunded'
    }, { transaction });

    // Trigger notifikasi pembatalan
    await Notification.create({
      user_id: order.user_id,
      message: `Pesanan #${order.id} telah dibatalkan.`,
      type: 'order'
    });

    await transaction.commit();

    const car = await Layanan.findByPk(order.layanan_id);
    const durasi = calculateRentalDuration(order.pickup_date, order.return_date);

    return res.json({
      success: true,
      message: "Pesanan berhasil dibatalkan",
      data: formatReceiptResponse(order, car, durasi)
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error membatalkan pesanan:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal membatalkan pesanan"
    });
  }
};

// Ambil semua pesanan untuk admin
exports.getAllOrdersAdmin = async (req, res) => {
  try {
    // Ambil query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const offset = (page - 1) * limit;

    // Filter pencarian dan status
    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { '$user.name$': { [Op.iLike]: `%${search}%` } },
        { '$layanan.nama$': { [Op.iLike]: `%${search}%` } },
        { id: { [Op.eq]: Number(search) || 0 } }
      ];
    }

    // Query dengan relasi user & layanan
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: Layanan, as: 'layanan', attributes: ['id', 'nama', 'harga', 'promo'] },
        { model: User, as: 'user', attributes: ['id', 'name'] }
      ],
      order: [['order_date', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error("Error getAllOrdersAdmin:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await Order.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['name', 'email'] },
        { model: Layanan, as: 'layanan', attributes: ['nama'] }
      ]
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
    }
    order.status = status;
    await order.save();

    // Kirim email notifikasi ke user
    if (order.user && order.user.email) {
      let statusLabel = "";
      switch (status) {
        case "pending": statusLabel = "Menunggu"; break;
        case "confirmed": statusLabel = "Dikonfirmasi"; break;
        case "completed": statusLabel = "Selesai"; break;
        case "cancelled": statusLabel = "Dibatalkan"; break;
        case "rejected": statusLabel = "Ditolak"; break;
        default: statusLabel = status;
      }
      await sendMail({
        to: order.user.email,
        subject: `Status Pesanan #${order.id} Diubah Menjadi ${statusLabel}`,
        html: `
          <div style="font-family: Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2>Status Pesanan Anda Telah Diubah</h2>
            <p>Halo <b>${order.user.name}</b>,</p>
            <p>Status pesanan Anda untuk mobil <b>${order.layanan?.nama || "-"}</b> telah diubah menjadi <b>${statusLabel}</b>.</p>
            <p>ID Pesanan: <b>#${order.id}</b></p>
            <p>Terima kasih telah menggunakan layanan kami.</p>
          </div>
        `
      });
    }
    if (order.user && order.user.no_telp) {
      await sendWhatsappFonnte(
        order.user.no_telp,
        `Status pesanan #${order.id} Anda telah diubah menjadi ${status}.`
      );
    }

    // Kirim notifikasi ke admin via socket.io
    req.app.get('io').emit('new_order', {
      title: 'Status Pesanan Diperbarui',
      message: `Status pesanan #${order.id} (${order.layanan?.nama || '-'}) diubah menjadi ${status}.`,
      type: 'order',
      createdAt: new Date().toISOString(),
      read: false
    });

    res.json({ success: true, message: "Status pesanan berhasil diupdate", data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal update status pesanan" });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
    }
    await order.destroy();
    res.json({ success: true, message: "Pesanan berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal menghapus pesanan" });
  }
};

// Mendapatkan daftar tanggal booking (range) untuk satu mobil
exports.getBookedDates = async (req, res) => {
  try {
    const { id } = req.params; // id = layanan_id
    const orders = await Order.findAll({
      where: {
        layanan_id: id,
        status: { [Op.notIn]: ["cancelled", "completed"] }
      },
      attributes: ["pickup_date", "return_date"]
    });
    // Format: [{start: "2024-06-20", end: "2024-06-22"}, ...]
    const bookedDates = orders.map(order => ({
      start: order.pickup_date,
      end: order.return_date
    }));
    res.json({ bookedDates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkCarAvailability = async (req, res) => {
  try {
    const { layanan_id, pickup_date, return_date } = req.query;
    if (!layanan_id || !pickup_date || !return_date) {
      return res.status(400).json({ available: false, message: "Parameter tidak lengkap" });
    }
    const isAvailable = await cekKetersediaanMobil(
      layanan_id,
      new Date(pickup_date),
      new Date(return_date)
    );
    res.json({ available: isAvailable });
  } catch (err) {
    res.status(500).json({ available: false, message: err.message });
  }
};

exports.addToCalendar = async (req, res) => {
  // Simulasi, bisa diintegrasikan dengan Google Calendar API
  const { title, start, end } = req.body;
  // Simpan ke DB jika perlu
  res.json({ success: true, message: "Booking berhasil ditambahkan ke Google Calendar (simulasi)." });
};

// Helper untuk notifikasi pembayaran
const sendPaymentReminder = async (order, user, car) => {
  const pickupDate = new Date(order.pickup_date).toLocaleDateString('id-ID');
  const returnDate = new Date(order.return_date).toLocaleDateString('id-ID');
  const totalPrice = Number(order.total_price).toLocaleString('id-ID');
  
  // Email reminder
  await sendMail({
    to: user.email,
    subject: `🚗 Reminder Pembayaran Pesanan #${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1976d2; color: #fff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 1.5rem;">Segera Selesaikan Pembayaran Anda</h2>
        </div>
        
        <div style="padding: 28px 24px;">
          <p style="margin-bottom: 16px;">Halo <b>${user.name}</b>,</p>
          
          <p style="margin-bottom: 16px;">
            Kami ingin mengingatkan Anda untuk segera menyelesaikan pembayaran pesanan rental mobil Anda.
            Berikut detail pesanan Anda:
          </p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 40%; color: #555;">ID Pesanan</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>#${order.id}</b></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Mobil</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${car?.nama || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Tanggal Sewa</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${pickupDate} - ${returnDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Total Pembayaran</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Rp${totalPrice}</b></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;">Status</td>
                <td style="padding: 8px 0;"><span style="color: #d32f2f; font-weight: bold;">Belum Dibayar</span></td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="http://localhost:3000/orders/${order.id}/payment" 
               style="display: inline-block; background: #1976d2; color: #fff; text-decoration: none; 
                      padding: 12px 24px; border-radius: 4px; font-weight: bold;">
              Bayar Sekarang
            </a>
          </div>
          
          <p style="margin-bottom: 8px; color: #d32f2f; font-weight: bold;">
            ⚠️ Batas waktu pembayaran: 24 jam setelah pemesanan
          </p>
          
          <p style="margin-top: 24px; color: #555;">
            Jika sudah melakukan pembayaran, silakan upload bukti pembayaran di halaman pesanan Anda.
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 16px; text-align: center; color: #777; font-size: 0.9rem;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Rental Mobil HS. All rights reserved.</p>
        </div>
      </div>
    `
  });

  // WhatsApp reminder
  if (user.no_telp) {
    await sendWhatsappFonnte(
      user.no_telp,
      `🚗 *Reminder Pembayaran* 🚗\n\nHalo ${user.name},\n\nAnda belum menyelesaikan pembayaran untuk pesanan rental mobil:\n\n` +
      `🔹 *ID Pesanan*: #${order.id}\n` +
      `🔹 *Mobil*: ${car?.nama || '-'}\n` +
      `🔹 *Tanggal Sewa*: ${pickupDate} - ${returnDate}\n` +
      `🔹 *Total*: Rp${totalPrice}\n\n` +
      `Segera selesaikan pembayaran dalam *24 jam* untuk menghindari pembatalan otomatis.\n\n` +
      `🔗 *Link Pembayaran*: http://localhost:3000/orders/${order.id}/payment\n\n` +
      `Terima kasih,\nRental Mobil HS`
    );
  }
};

const sendPaymentConfirmation = async (order, user, car) => {
  const pickupDate = new Date(order.pickup_date).toLocaleDateString('id-ID');
  const returnDate = new Date(order.return_date).toLocaleDateString('id-ID');
  const totalPrice = Number(order.total_price).toLocaleString('id-ID');
  
  // Email konfirmasi
  await sendMail({
    to: user.email,
    subject: `✅ Pembayaran Pesanan #${order.id} Berhasil`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #4caf50; color: #fff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 1.5rem;">Pembayaran Berhasil Diterima</h2>
        </div>
        
        <div style="padding: 28px 24px;">
          <p style="margin-bottom: 16px;">Halo <b>${user.name}</b>,</p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 40%; color: #555;">ID Pesanan</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>#${order.id}</b></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Mobil</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${car?.nama || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Tanggal Sewa</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${pickupDate} - ${returnDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555;">Total Pembayaran</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><b>Rp${totalPrice}</b></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555;">Status</td>
                <td style="padding: 8px 0;"><span style="color: #4caf50; font-weight: bold;">Lunas</span></td>
              </tr>
            </table>
          </div>
          
          <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="margin-top: 0; color: #2e7d32;">Langkah Selanjutnya</h3>
            <ol style="padding-left: 20px; margin-bottom: 0;">
              <li style="margin-bottom: 8px;">Anda akan menerima konfirmasi dari admin kami</li>
              <li style="margin-bottom: 8px;">Pastikan kontak yang terdaftar aktif</li>
              <li style="margin-bottom: 8px;">Simpan ID pesanan ini untuk referensi</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="http://localhost:3000/orders/${order.id}" 
               style="display: inline-block; background: #4caf50; color: #fff; text-decoration: none; 
                      padding: 12px 24px; border-radius: 4px; font-weight: bold;">
              Lihat Detail Pesanan
            </a>
          </div>
          
          <p style="margin-top: 24px; color: #555;">
            Terima kasih telah mempercayai Rental Mobil HS. Kami akan menghubungi Anda untuk konfirmasi lebih lanjut.
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 16px; text-align: center; color: #777; font-size: 0.9rem;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Rental Mobil HS. All rights reserved.</p>
        </div>
      </div>
    `
  });

  // WhatsApp konfirmasi
  if (user.no_telp) {
    await sendWhatsappFonnte(
      user.no_telp,
      `✅ *Pembayaran Diterima* ✅\n\nHalo ${user.name},\n\nPembayaran Anda untuk pesanan rental mobil telah berhasil kami terima:\n\n` +
      `🔹 *ID Pesanan*: #${order.id}\n` +
      `🔹 *Mobil*: ${car?.nama || '-'}\n` +
      `🔹 *Tanggal Sewa*: ${pickupDate} - ${returnDate}\n` +
      `🔹 *Total*: Rp${totalPrice}\n\n` +
      `Status pesanan Anda sekarang *Terkonfirmasi*. Admin kami akan segera menghubungi Anda untuk konfirmasi lebih lanjut.\n\n` +
      `Terima kasih telah menggunakan layanan Rental Mobil HS.`
    );
  }
};

// Endpoint manual reminder pembayaran
exports.sendPaymentReminderManual = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId, {
      include: [
        { model: User, as: 'user' },
        { model: Layanan, as: 'layanan' }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if(order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: "Order already paid" });
    }

    await sendPaymentReminder(order, order.user, order.layanan);

    return res.json({ 
      success: true, 
      message: "Payment reminder sent successfully" 
    });
  } catch (error) {
    console.error("Error sending payment reminder:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to send payment reminder" 
    });
  }
};