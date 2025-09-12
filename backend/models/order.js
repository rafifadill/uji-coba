const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user', // Nama model/tabel User
      key: 'id'
    }
  },
  layanan_id: {
  type: DataTypes.INTEGER,
  allowNull: false,
  references: {
    model: 'layanan',
    key: 'id'
  }
},
  order_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  pickup_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'tanggal pengambilan mobil'
  },
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'tanggal pengembalian mobil'
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'total harga sewa'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'status pesanan'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'metode pembayaran'
  },
  payment_proof: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path/link ke bukti pembayaran'
  },
  payment_status: {
    type: DataTypes.ENUM('unpaid', 'paid', 'failed', 'pending_verification', 'rejected', 'refunded'),
    allowNull: false,
    defaultValue: 'unpaid',
    comment: 'status pembayaran'
  },
  additional_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'catatan tambahan'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  charset: 'utf8mb4',
  collate: 'utf8mb4_general_ci',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['layanan_id'] }
  ]
});

Order.associate = (models) => {
  Order.belongsTo(models.Layanan, {
    foreignKey: 'layanan_id',
    as: 'layanan'
  });
  Order.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
};
module.exports = Order;
