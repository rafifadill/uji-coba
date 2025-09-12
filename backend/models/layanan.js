const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const Layanan = sequelize.define('Layanan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  deskripsi: {
    type: DataTypes.TEXT, // ubah dari STRING ke TEXT
    allowNull: true,
  },
  harga: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  gambar: {
    type: DataTypes.STRING,
    allowNull: true, // opsional
  },
  kategori: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Umum',
  },
  status: {
    type: DataTypes.ENUM('available', 'unavailable'),
    allowNull: false,
    defaultValue: 'available'
  },
  promo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  jumlah_review: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  transmisi: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "Automatic"
  },
  kapasitas: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 4
  },
  fitur: {
    type: DataTypes.JSON, // atau TEXT jika array string
    allowNull: true,
    defaultValue: []
  }
}, 
{
  tableName: 'layanan',
  timestamps: false,
});

Layanan.associate = (models) => {
  Layanan.hasMany(models.Order, {
    foreignKey: 'layanan_id',
    as: 'orders'
  });
};
module.exports = Layanan;
