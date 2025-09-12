const cron = require('node-cron');
const { blast } = require('../controllers/notificationController');

// Setiap Senin jam 08:00
cron.schedule('0 8 * * 1', async () => {
  await blast({ body: { message: "Promo minggu ini! Cek aplikasi sekarang." } }, { json: () => {} });
});