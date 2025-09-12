// controllers/testimoni.js
const Testimoni = require('../models/testimoni');
const User = require('../models/user'); // pastikan ada model user

const testimoniController = {
  getAllTestimoni: async (req, res) => {
    try {
      const testimonials = await Testimoni.findAll();
      res.json(testimonials);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addTestimoni: async (req, res) => {
    try {
      let { user_id } = req.body;
      if (
        !user_id ||
        user_id === "" ||
        isNaN(Number(user_id))
      ) {
        delete req.body.user_id;
      } else {
        // cek apakah user_id ada di tabel user
        const user = await User.findByPk(user_id);
        if (!user) {
          return res.status(400).json({ error: "User ID tidak ditemukan" });
        }
      }
      const newTestimoni = await Testimoni.create(req.body);
      res.status(201).json(newTestimoni);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  deleteTestimoni: async (req, res) => {
    try {
      await Testimoni.destroy({ where: { id: req.params.id } });
      res.json({ message: 'Testimoni deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  reply: async (req, res) => {
    try {
      const { id } = req.params;
      const { reply } = req.body;
      const testimoni = await Testimoni.findByPk(id);
      if (!testimoni) return res.status(404).json({ error: "Not found" });
      testimoni.reply = reply;
      await testimoni.save();
      res.json(testimoni);
    } catch (error) {
      console.error("Gagal membalas testimoni:", error); // Tambahkan log ini
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = testimoniController;