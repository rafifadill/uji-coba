const Layanan = require('../models/layanan');
const Testimoni = require('../models/testimoni');
const { Sequelize, Op } = require('sequelize');
const { Order, sequelize } = require('../models');

exports.getAll = async (req, res) => {
  try {
    const layanan = await Layanan.findAll();

    const layananWithRating = await Promise.all(layanan.map(async (item) => {
      const testimoni = await Testimoni.findAll({
        where: { layanan_id: item.id }
      });
      let rating = null;
      let jumlah_review = 0;
      if (testimoni.length > 0) {
        jumlah_review = testimoni.length;
        rating = testimoni.reduce((sum, t) => sum + t.rating, 0) / jumlah_review;
        rating = Math.round(rating * 10) / 10;
      }
      // --- Normalisasi fitur di sini ---
      let fitur = item.fitur;
      if (!fitur) fitur = [];
      else if (typeof fitur === "string") fitur = fitur.split(",").map(f => f.trim()).filter(Boolean);
      else if (!Array.isArray(fitur)) fitur = [];
      // ---------------------------------
      return {
        ...item.toJSON(),
        fitur,
        rating,
        jumlah_review
      };
    }));

    res.json({ success: true, data: layananWithRating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const layanan = await Layanan.findByPk(req.params.id);
    if (!layanan) return res.status(404).json({ message: 'Layanan tidak ditemukan' });

    const testimoni = await Testimoni.findAll({
      where: { layanan_id: layanan.id }
    });
    let rating = null;
    let jumlah_review = 0;
    if (testimoni.length > 0) {
      jumlah_review = testimoni.length;
      rating = testimoni.reduce((sum, t) => sum + t.rating, 0) / jumlah_review;
      rating = Math.round(rating * 10) / 10;
    }
    // --- Normalisasi fitur di sini ---
    let fitur = layanan.fitur;
    if (!fitur) fitur = [];
    else if (typeof fitur === "string") fitur = fitur.split(",").map(f => f.trim()).filter(Boolean);
    else if (!Array.isArray(fitur)) fitur = [];
    // ---------------------------------
    res.json({ success: true, data: { ...layanan.toJSON(), fitur, rating, jumlah_review } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { nama, kategori, harga, status, deskripsi, promo, rating, jumlah_review, transmisi, kapasitas, fitur } = req.body;
    let gambar = null;
    if (req.file) {
      gambar = `/uploads/${req.file.filename}`;
    }
    if (!nama || !kategori || !harga) {
      return res.status(400).json({ message: "Nama, kategori, dan harga wajib diisi" });
    }
    // Saat create/update layanan
    const fiturArray = Array.isArray(fitur)
      ? fitur
      : typeof fitur === "string"
        ? fitur.split(",").map(f => f.trim())
        : [];
    const layanan = await Layanan.create({
      nama, kategori, harga, status: status || 'available', deskripsi: deskripsi || '',
      gambar, promo, rating, jumlah_review, transmisi, kapasitas, fitur: fiturArray
    });
    res.status(201).json({ success: true, data: layanan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const layanan = await Layanan.findByPk(req.params.id);
    if (!layanan) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
    const { nama, kategori, harga, status, deskripsi, promo, rating, jumlah_review, transmisi, kapasitas, fitur } = req.body;
    let gambar = layanan.gambar;
    if (req.file) {
      gambar = `/uploads/${req.file.filename}`;
    }
    // Saat create/update layanan
    const fiturArray = Array.isArray(fitur)
      ? fitur
      : typeof fitur === "string"
        ? fitur.split(",").map(f => f.trim())
        : [];
    await layanan.update({
      nama: nama ?? layanan.nama,
      kategori: kategori ?? layanan.kategori,
      harga: harga ?? layanan.harga,
      status: status ?? layanan.status,
      deskripsi: deskripsi ?? layanan.deskripsi,
      gambar,
      promo: promo ?? layanan.promo,
      rating: rating ?? layanan.rating,
      jumlah_review: jumlah_review ?? layanan.jumlah_review,
      transmisi: transmisi ?? layanan.transmisi,
      kapasitas: kapasitas ?? layanan.kapasitas,
      fitur: fiturArray
    });
    res.json({ success: true, data: layanan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const layanan = await Layanan.findByPk(req.params.id);
    if (!layanan) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
    await layanan.destroy();
    res.json({ success: true, message: "Layanan berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAvailable = async (req, res) => {
  try {
    const layanan = await Layanan.findAll({ where: { status: 'available' } });
    // ...tambahkan rating & jumlah_review jika perlu...
    res.json({ success: true, data: layanan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOmzetLayanan = async (req, res) => {
  try {
    const omzet = await Order.findAll({
      where: { status: 'completed' },
      attributes: [
        'layanan_id',
        [sequelize.fn('SUM', sequelize.col('total_price')), 'total_omzet'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jumlah_order']
      ],
      group: ['layanan_id']
    });

    // Pastikan hasilnya array of plain object
    const omzetData = omzet.map(item => ({
      layanan_id: item.layanan_id,
      total_omzet: Number(item.get('total_omzet')) || 0,
      jumlah_order: Number(item.get('jumlah_order')) || 0
    }));

    res.json({ success: true, data: omzetData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
