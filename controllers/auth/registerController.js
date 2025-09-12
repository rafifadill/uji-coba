const User = require('../../models/user');
const bcrypt = require('bcryptjs');

const registerUser = async (req, res) => {
  try {
    // Validasi awal data JSON
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Data request harus berupa JSON valid' 
      });
    }

    const { name, email, password, no_telp } = req.body;

    // Validasi field required
    if (!name || !email || !password || !no_telp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Semua field harus diisi' 
      });
    }

    // Validasi format email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format email tidak valid' 
      });
    }

    // Validasi nomor telepon
    if (!/^\d{10,13}$/.test(no_telp)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nomor telepon harus 10-13 digit angka' 
      });
    }

    // Validasi panjang password
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password minimal 6 karakter' 
      });
    }

    // Cek email unik
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email sudah terdaftar' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user baru
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      no_telp,
      role: "user"
    });

    // Jangan kembalikan password
    const userResponse = { ...newUser.toJSON() };
    delete userResponse.password;

    return res.status(201).json({ 
      success: true, 
      user: userResponse 
    });

  } catch (error) {
    console.error('Error registrasi:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
};

module.exports = { registerUser };
