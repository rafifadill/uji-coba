const midtransClient = require('midtrans-client');
let snap = new midtransClient.Snap({
  isProduction: true, // HARUS true untuk production
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const { User, Layanan } = require('../models');

exports.createPayment = async (req, res) => {
  const { order_id, gross_amount, customer } = req.body;
  let snap = new midtransClient.Snap({
    isProduction: true, // HARUS true untuk production
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
  });

  const parameter = {
    transaction_details: { order_id, gross_amount },
    customer_details: customer,
  };

  try {
    const transaction = await snap.createTransaction(parameter);
    res.json({ token: transaction.token });
  } catch (err) {
    console.error("Midtrans error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.handleMidtransCallback = async (req, res) => {
  try {
    const notif = req.body;
    // Cek status transaksi dari Midtrans
    const { order_id, transaction_status, payment_type } = notif;

    // Temukan order di database berdasarkan order_id Midtrans
    const order = await Order.findOne({ where: { midtrans_order_id: order_id } });
    if (!order) return res.status(404).json({ message: "Order tidak ditemukan" });

    // Update status sesuai status dari Midtrans
    let payment_status = "pending";
    let status = "pending";
    if (transaction_status === "settlement" || transaction_status === "capture") {
      payment_status = "paid";
      status = "confirmed";
    } else if (transaction_status === "deny" || transaction_status === "expire" || transaction_status === "cancel") {
      payment_status = "failed";
      status = "cancelled";
    }
    await order.update({
      payment_status,
      status,
      payment_method: payment_type
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createMidtransToken = async (req, res) => {
  const { order_id, gross_amount, layanan_id } = req.body;
  const userId = req.user.id;

  // Ambil data user dari database
  const user = await User.findByPk(userId);
  // Ambil data mobil dari database
  const car = await Layanan.findByPk(layanan_id);

  const parameter = {
    transaction_details: {
      order_id,
      gross_amount,
    },
    customer_details: {
      first_name: user.name,
      email: user.email,
      phone: user.no_telp,
      address: user.address || "-",
      shipping_address: user.address || "-",
    },
    item_details: [
      {
        id: car.id,
        price: gross_amount,
        quantity: 1,
        name: car.nama,
      },
    ],
  };

  try {
    const transaction = await snap.createTransaction(parameter);
    res.json({ token: transaction.token, order_id });
  } catch (err) {
    console.error("Midtrans error:", err);
    res.status(500).json({ error: err.message });
  }
};