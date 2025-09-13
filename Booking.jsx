import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  FaCar, 
  FaMoneyBillWave, 
  FaCalendarAlt, 
  FaCreditCard, 
  FaArrowLeft, 
  FaTimesCircle 
} from "react-icons/fa";
import { format, addDays, isBefore } from "date-fns";
import AOS from "aos";
import "aos/dist/aos.css";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../style/BookingPage.css";
import axios from "axios";
import { API_URL } from "../utils/api"; // gunakan API_URL dari utils

const getHargaSetelahPromo = (price, promo) => {
  if (promo && promo > 0) {
    return Math.round(price - (price * promo / 100));
  }
  return price;
};

const Booking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    carId,
    carName,
    price,
    discount,
    image,
    days = 1,
  } = location.state || {};

  const hargaPromo = getHargaSetelahPromo(price, discount);
  const totalHarga = hargaPromo * days;

  const [formData, setFormData] = useState({
    layanan_id: carId,
    pickup_date: "",
    return_date: "",
    payment_method: "midtrans", // default midtrans
    additional_notes: "",
    total_price: totalHarga,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [activeTab, setActiveTab] = useState("booking");
  const [bookedDates, setBookedDates] = useState([]);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const tokenExpiry = localStorage.getItem("token_expiry");

    if (!token || Date.now() > tokenExpiry) {
      setIsSessionExpired(true);
      toast.error("Session expired. Please log in again.");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (formData.pickup_date && days) {
      const pickupDate = new Date(formData.pickup_date);
      const returnDate = addDays(pickupDate, days);
      setFormData((prev) => ({
        ...prev,
        return_date: format(returnDate, "yyyy-MM-dd"),
      }));
    }
  }, [formData.pickup_date, days]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Hapus validasi payment_proof di validateForm
  const validateForm = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!formData.pickup_date) {
      newErrors.pickup_date = "Pickup date is required";
    } else if (isBefore(new Date(formData.pickup_date), today)) {
      newErrors.pickup_date = "Pickup date cannot be in the past";
    }

    if (!formData.return_date) {
      newErrors.return_date = "Return date is required";
    } else if (isBefore(new Date(formData.return_date), new Date(formData.pickup_date))) {
      newErrors.return_date = "Return date must be after pickup date";
    }

    if (!formData.payment_method) {
      newErrors.payment_method = "Payment method is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Silakan lengkapi formulir dengan benar.", {
        position: "top-right",
        autoClose: 3500,
        theme: "colored",
        icon: "⚠️"
      });
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Token autentikasi tidak ditemukan", {
          position: "top-right",
          autoClose: 3500,
          theme: "colored",
          icon: "❌"
        });
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('layanan_id', Number(formData.layanan_id));
      formDataToSend.append('pickup_date', formData.pickup_date);
      formDataToSend.append('return_date', formData.return_date);
      formDataToSend.append('payment_method', formData.payment_method);
      formDataToSend.append('additional_notes', formData.additional_notes);
      formDataToSend.append('total_price', formData.total_price);

      const response = await axios.post(
        `${API_URL}/orders`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      toast.success("Pesanan berhasil dibuat! Detail pesanan akan dikirim ke email Anda.", {
        position: "top-right",
        autoClose: 2500,
        theme: "colored",
        icon: "✅"
      });

      const orderId = response.data?.data?.id;
      if (!orderId) {
        toast.error("Gagal mendapatkan ID pesanan dari server", {
          position: "top-right",
          autoClose: 3500,
          theme: "colored",
          icon: "❌"
        });
        return;
      }
      const responseReceipt = await axios.get(
        `${API_URL}/orders/${orderId}/receipt`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (responseReceipt.data?.data?.id) {
        navigate(`/orders/${responseReceipt.data.data.id}/receipt`);
      } else {
        toast.error("Gagal mendapatkan ID pesanan", {
          position: "top-right",
          autoClose: 3500,
          theme: "colored",
          icon: "❌"
        });
      }
    } catch (error) {
      let errorMessage = "Gagal membuat pesanan";
      if (error.response) {
        errorMessage =
          error.response.data.message ||
          error.response.data.error ||
          errorMessage;
      } else if (error.request) {
        errorMessage = "Tidak ada respon dari server";
      } else {
        errorMessage = error.message;
      }
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3500,
        theme: "colored",
        icon: "❌"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ambil daftar tanggal tidak tersedia saat carId berubah
  useEffect(() => {
    if (!carId) return;
    axios
      .get(`${API_URL}/orders/layanan/${carId}/booked-dates`)
      .then(res => setBookedDates(res.data.bookedDates || []))
      .catch(() => setBookedDates([]));
  }, [carId]);

  // Cek ketersediaan setiap kali tanggal berubah
  useEffect(() => {
    if (!formData.pickup_date || !formData.return_date || !carId) {
      setIsAvailable(null);
      return;
    }
    setIsChecking(true);
    axios
      .get(`${API_URL}/orders/check-availability`, {
        params: {
          layanan_id: carId,
          pickup_date: formData.pickup_date,
          return_date: formData.return_date
        }
      })
      .then(res => setIsAvailable(res.data.available))
      .catch(() => setIsAvailable(false))
      .finally(() => setIsChecking(false));
  }, [formData.pickup_date, formData.return_date, carId]);

  // Saat klik tombol pesan/bayar, cek ulang ketersediaan sebelum create order
  const handleMidtransPayment = async () => {
    if (!formData.pickup_date || !formData.return_date) {
      toast.error("Pilih tanggal sewa terlebih dahulu!");
      return;
    }
    setIsLoading(true);
    try {
      // Cek ketersediaan ulang
      const availRes = await axios.get(`${API_URL}/orders/check-availability`, {
        params: {
          layanan_id: carId,
          pickup_date: formData.pickup_date,
          return_date: formData.return_date
        }
      });
      if (!availRes.data.available) {
        toast.error("Mobil tidak tersedia pada tanggal yang dipilih!");
        setIsAvailable(false);
        setIsLoading(false);
        return;
      }
      setIsAvailable(true);

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Token autentikasi tidak ditemukan", {
          position: "top-right",
          autoClose: 3500,
          theme: "colored",
          icon: "❌"
        });
        return;
      }

      const order_id = `ORDER-${Date.now()}`;
      const gross_amount = formData.total_price;
      const layanan_id = Number(formData.layanan_id);

      // Dapatkan Snap token dari backend
      const res = await axios.post(
        `${API_URL}/payment/midtrans-token`,
        {
          order_id,
          gross_amount,
          layanan_id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data && res.data.token) {
        window.snap.pay(res.data.token, {
          onSuccess: async function(result) {
            toast.success("Pembayaran berhasil!", {
              position: "top-right",
              autoClose: 2500,
              theme: "colored",
              icon: "✅"
            });
            const paymentMethod = result.payment_type || "midtrans";
            const orderRes = await axios.post(
              `${API_URL}/orders`,
              {
                layanan_id: Number(formData.layanan_id),
                pickup_date: formData.pickup_date,
                return_date: formData.return_date,
                payment_method: paymentMethod,
                additional_notes: formData.additional_notes,
                total_price: formData.total_price,
                payment_status: "paid",
                midtrans_order_id: result.order_id,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (orderRes.data?.data?.id) {
              navigate(`/orders/${orderRes.data.data.id}/receipt`);
            } else {
              toast.error("Gagal mendapatkan ID pesanan");
            }
          },
          onPending: async function(result) {
            toast.info("Pembayaran masih diproses.", {
              position: "top-right",
              autoClose: 3500,
              theme: "colored",
              icon: "⏳"
            });
            const paymentMethod = result.payment_type || "midtrans";
            const orderRes = await axios.post(
              `${API_URL}/orders`,
              {
                layanan_id: Number(formData.layanan_id),
                pickup_date: formData.pickup_date,
                return_date: formData.return_date,
                payment_method: paymentMethod,
                additional_notes: formData.additional_notes,
                total_price: formData.total_price,
                payment_status: "unpaid",
                midtrans_order_id: result.order_id,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (orderRes.data?.data?.id) {
              navigate(`/orders/${orderRes.data.data.id}/receipt`);
            } else {
              toast.error("Gagal mendapatkan ID pesanan");
            }
          },
          onError: async function(result) {
            toast.error("Pembayaran gagal.", {
              position: "top-right",
              autoClose: 3500,
              theme: "colored",
              icon: "❌"
            });
            const paymentMethod = result?.payment_type || "midtrans";
            const orderRes = await axios.post(
              `${API_URL}/orders`,
              {
                layanan_id: Number(formData.layanan_id),
                pickup_date: formData.pickup_date,
                return_date: formData.return_date,
                payment_method: paymentMethod,
                additional_notes: formData.additional_notes,
                total_price: formData.total_price,
                payment_status: "failed",
                midtrans_order_id: result?.order_id,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (orderRes.data?.data?.id) {
              navigate(`/orders/${orderRes.data.data.id}/receipt`);
            } else {
              toast.error("Pembayaran gagal dan pesanan tidak tercatat.");
            }
          },
          onClose: async function() {
            const orderRes = await axios.post(
              `${API_URL}/orders`,
              {
                layanan_id: Number(formData.layanan_id),
                pickup_date: formData.pickup_date,
                return_date: formData.return_date,
                payment_method: "midtrans",
                additional_notes: formData.additional_notes,
                total_price: formData.total_price,
                payment_status: "unpaid",
                midtrans_order_id: order_id, // gunakan order_id yang sama
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (orderRes.data?.data?.id) {
              navigate(`/orders/${orderRes.data.data.id}/receipt`);
            } else {
              toast.error("Pesanan gagal dibuat setelah menutup pembayaran.");
            }
          }
        });
      } else {
        toast.error("Gagal mendapatkan token pembayaran dari server");
      }
    } catch (error) {
      let errorMessage = "Gagal memproses pembayaran";
      if (error.response) {
        errorMessage =
          error.response.data.message ||
          error.response.data.error ||
          errorMessage;
      } else if (error.request) {
        errorMessage = "Tidak ada respon dari server";
      } else {
        errorMessage = error.message;
      }
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3500,
        theme: "colored",
        icon: "❌"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="booking-page" data-aos="fade-up">
      <div className="container">
        <div className="header-booking">
          <h2>Pemesanan Mobil</h2>
          <button className="btn-back" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Kembali
          </button>
        </div>

        <div className="car-details">
          <img src={image} alt={carName} className="car-image" />
          <div className="car-info">
            <h3>{carName}</h3>
            <p className="car-price">
              Harga: <strong>Rp {price.toLocaleString()}</strong> / hari
            </p>
            {discount > 0 && (
              <p className="car-discount">
                Diskon: <strong>{discount}%</strong>
              </p>
            )}
          </div>
        </div>

        <div className="booking-form">
          <h3>Form Pemesanan</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="pickup_date">Tanggal Ambil</label>
              <input
                type="date"
                id="pickup_date"
                name="pickup_date"
                value={formData.pickup_date}
                onChange={handleChange}
                className={errors.pickup_date ? "error" : ""}
                required
              />
              {errors.pickup_date && (
                <span className="error-message">{errors.pickup_date}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="return_date">Tanggal Kembali</label>
              <input
                type="date"
                id="return_date"
                name="return_date"
                value={formData.return_date}
                onChange={handleChange}
                className={errors.return_date ? "error" : ""}
                required
              />
              {errors.return_date && (
                <span className="error-message">{errors.return_date}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="payment_method">Metode Pembayaran</label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className={errors.payment_method ? "error" : ""}
                required
              >
                <option value="midtrans">Midtrans</option>
                <option value="bank_transfer">Transfer Bank</option>
                <option value="cash">Tunai</option>
              </select>
              {errors.payment_method && (
                <span className="error-message">{errors.payment_method}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="additional_notes">Catatan Tambahan</label>
              <textarea
                id="additional_notes"
                name="additional_notes"
                value={formData.additional_notes}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Total Harga</label>
              <p className="total-price">
                Rp {formData.total_price.toLocaleString()}
              </p>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Memproses..." : "Pesan Sekarang"}
              </button>
            </div>
          </form>
        </div>

        <div className="terms-and-conditions">
          <h3>Syarat dan Ketentuan</h3>
          <ul>
            <li>Mobil harus dikembalikan dalam kondisi baik.</li>
            <li>Isi bahan bakar akan diperiksa saat pengembalian.</li>
            <li>Late return akan dikenakan biaya tambahan.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

Booking.propTypes = {
  carId: PropTypes.string,
  carName: PropTypes.string,
  price: PropTypes.number,
  discount: PropTypes.number,
  image: PropTypes.string,
  days: PropTypes.number,
};

export default Booking;