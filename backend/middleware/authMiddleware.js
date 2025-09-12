const jwt = require("jsonwebtoken");
const User = require("../models/user"); // Sesuaikan dengan model User Anda
require("dotenv").config();

// Middleware untuk memverifikasi token
const authMiddleware = async (req, res, next) => {
  try {
    // Ambil token dari header Authorization
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan, otorisasi ditolak",
      });
    }

    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);

    // Cari user berdasarkan id yang ada pada token
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User tidak ditemukan" });
    }

    // Tambahkan user ke request object
    req.user = user;
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(401).json({ success: false, message: "Token tidak valid" });
  }
};
const checkAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ success: false, message: "Akses hanya untuk admin" });
  }
};
module.exports = {authMiddleware,checkAdmin};