const db = require('../models');
const Notification = db.Notification;
const User = db.User;
const { sendMail } = require("../utils/email");
const { sendWA, sendWhatsappFonnte } = require("../utils/whatsapp");

exports.getAll = async (req, res) => {
  try {
    const where = req.user.role === "admin"
      ? {}
      : { user_id: req.user.id };
    const notifications = await Notification.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notif = await Notification.findByPk(req.params.id);
    if (!notif) return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    // Hanya admin atau pemilik notifikasi yang bisa menandai
    if (req.user.role !== "admin" && notif.user_id !== req.user.id) {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    notif.read = true;
    await notif.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { user_id: req.user.id };
    await Notification.update({ read: true }, { where });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.blast = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Hanya admin yang bisa blast notifikasi" });
    }
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }
    const users = await User.findAll({ where: { status: 'active' } });
    let successCount = 0, failCount = 0;
    for (const user of users) {
      try {
        if (user.email) {
          await sendMail({
            to: user.email,
            subject: "Notifikasi dari Admin",
            html: message
          });
        }
        if (user.no_telp && typeof sendWA === "function") {
          await sendWA(user.no_telp, message);
        }
        await Notification.create({ user_id: user.id, message, type: "blast" });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    res.json({
      success: true,
      message: `Notifikasi dikirim ke ${successCount} user${failCount ? `, gagal ke ${failCount} user` : ""}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { user_id: req.user.id };
    await Notification.destroy({ where });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteOne = async (req, res) => {
  try {
    const notif = await Notification.findByPk(req.params.id);
    if (!notif) return res.status(404).json({ message: "Notifikasi tidak ditemukan" });
    // Hanya admin atau pemilik notifikasi yang bisa hapus
    if (req.user.role !== "admin" && notif.user_id !== req.user.id) {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    await notif.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendWhatsapp = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Hanya admin yang bisa kirim WhatsApp" });
    }
    const { phone, message } = req.body;
    await sendWhatsappFonnte(phone, message);
    res.json({ success: true, message: "WhatsApp sent!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};