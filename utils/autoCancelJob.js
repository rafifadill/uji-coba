const cron = require('node-cron');
const { Order } = require('../models');
const { Op } = require('sequelize');

function startAutoCancelJob() {
  // Setiap 10 menit, cek order unpaid/pending lebih dari 24 jam
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 jam lalu

      const expiredOrders = await Order.findAll({
        where: {
          payment_status: { [Op.in]: ['unpaid', 'pending'] },
          status: { [Op.in]: ['pending'] },
          order_date: { [Op.lt]: expiredTime }
        }
      });

      for (const order of expiredOrders) {
        await order.update({
          status: 'cancelled',
          payment_status: 'expired'
        });
        // Optional: kirim notifikasi/email ke user
        console.log(`Order #${order.id} dibatalkan otomatis karena tidak dibayar >24 jam`);
      }
    } catch (err) {
      console.error('Auto cancel job error:', err);
    }
  });
}

module.exports = { startAutoCancelJob };