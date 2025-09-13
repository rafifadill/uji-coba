import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FaCar, FaCalendarAlt, FaMoneyBillWave, FaUser, FaFileInvoice, FaPrint, FaArrowLeft, FaCheckCircle, FaCreditCard, FaUniversity, FaMoneyCheckAlt, FaPhone, FaMapMarkerAlt, FaFileAlt, FaExclamationTriangle
} from "react-icons/fa";
import { format, parseISO, isValid } from "date-fns";
import id from "date-fns/locale/id";
import "../style/Receipt.css";
import { API_URL } from "../utils/api"; // gunakan API_URL dari utils

const formatDate = (dateString, formatPattern = "dd MMMM yyyy", includeTime = false) => {
  try {
    if (!dateString) return "-";
    let date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return "-";
    let result = format(date, formatPattern, { locale: id });
    if (includeTime) result += ` ${format(date, "HH:mm")}`;
    return result;
  } catch {
    return "-";
  }
};

const getPaymentMethodIcon = (method) => {
  switch ((method || "").toLowerCase()) {
    case "credit_card": return <FaCreditCard className="me-2 text-primary" />;
    case "bank_transfer": return <FaUniversity className="me-2 text-primary" />;
    case "e_wallet": return <FaMoneyCheckAlt className="me-2 text-primary" />;
    default: return <FaMoneyBillWave className="me-2 text-primary" />;
  }
};

const getPaymentMethodName = (method) => {
  switch ((method || "").toLowerCase()) {
    case "credit_card": return "Kartu Kredit";
    case "bank_transfer": return "Transfer Bank";
    case "e_wallet": return "E-Wallet";
    default: return method || "Tunai";
  }
};

const getStatusBadge = (status) => {
  let badgeClass = "", statusText = "";
  switch ((status || "").toLowerCase()) {
    case "paid": badgeClass = "bg-success"; statusText = "Lunas"; break;
    case "confirmed": badgeClass = "bg-success"; statusText = "Terkonfirmasi"; break;
    case "pending_verification":
    case "pending": badgeClass = "bg-warning text-dark"; statusText = "Menunggu Verifikasi"; break;
    case "unpaid": badgeClass = "bg-danger"; statusText = "Belum Dibayar"; break;
    case "cancelled": badgeClass = "bg-secondary"; statusText = "Dibatalkan"; break;
    case "completed": badgeClass = "bg-info"; statusText = "Selesai"; break;
    case "failed": badgeClass = "bg-danger"; statusText = "Gagal"; break;
    default: badgeClass = "bg-primary"; statusText = status || "Tidak diketahui";
  }
  return <span className={`badge ${badgeClass}`}>{statusText}</span>;
};

const OrderReceipt = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofUrl, setProofUrl] = useState("");

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Token tidak ditemukan");

        const response = await axios.get(
          `${API_URL}/orders/${orderId}/receipt`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data?.success && response.data?.data) {
          setReceipt(response.data.data);
        } else {
          throw new Error("Data struk tidak valid");
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Gagal memuat struk pesanan");
        // Redirect ke daftar pesanan jika 404
        if (err.response?.status === 404) {
          setTimeout(() => {
            navigate('/pesanan');
          }, 3000);
        }
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchReceipt();
    } else {
      setError("ID Pesanan tidak valid");
      setLoading(false);
    }
  }, [orderId, navigate]);

  // Show loading state
  if (loading) {
    return (
      <div className="receipt-page d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Memuat struk pesanan...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="receipt-page d-flex justify-content-center align-items-center">
        <div className="text-center">
          <FaExclamationTriangle className="text-danger mb-3" style={{ fontSize: '3rem' }} />
          <h4 className="mb-3">{error}</h4>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/pesanan')}
          >
            <FaArrowLeft className="me-2" />
            Kembali ke Daftar Pesanan
          </button>
        </div>
      </div>
    );
  }

  // Mapping sesuai backend
  const order = receipt.order;
  const car = receipt.car;
  const user = receipt.user;

  return (
    <div className="receipt-page" style={{ paddingTop: 70 }}>
      <div className="receipt-container">
        <div className="receipt-header">
          <div className="logo-title">
            <img src="/images/logo.png" alt="Logo" className="receipt-logo" />
            <div>
              <h2>RENTAL MOBIL HS</h2>
              <div className="receipt-contact">
                <FaMapMarkerAlt /> Jl. Watugajah Jl. Widyapura No.7, Dusun I, Singopuran, Kec. Kartasura, Kabupaten Sukoharjo
Jawa Tengah 57164<br />
                <FaPhone /> 0817-0455-544 | rentalhs591@gmail.com
              </div>
            </div>
          </div>
          <div className="receipt-actions no-print">
            <button className="btn btn-primary me-2" onClick={() => window.print()}>
              <FaPrint className="me-1" /> Cetak
            </button>
            <button className="btn btn-success" onClick={() => navigate("/pesanan")}>
              <FaFileInvoice className="me-1" /> Lihat Daftar Pesanan
            </button>
          </div>
        </div>
        <div className="receipt-main">
          <div className="receipt-invoice-info">
            <div>
              <span className="invoice-label">INVOICE</span>
              <span className="invoice-number">#{order.id}</span>
            </div>
            <div>
              <span className="invoice-date">
                Tanggal: {formatDate(order.order_date, "dd MMMM yyyy", true)}
              </span>
              <span className="invoice-status">
                Status: {getStatusBadge(order.payment_status)}
              </span>
            </div>
          </div>
          <div className="receipt-section">
            <div className="receipt-col">
              <h5><FaUser className="me-2" />Pelanggan</h5>
              <div className="receipt-info-list">
                <div><span>Nama</span><span>{user?.name || user?.nama || "-"}</span></div>
                <div><span>No. HP</span><span>{user?.phone || user?.no_telp || "-"}</span></div>
                <div><span>Email</span><span>{user?.email || "-"}</span></div>
              </div>
            </div>
            <div className="receipt-col">
              <h5><FaCar className="me-2" />Mobil</h5>
              <div className="receipt-info-list">
                <div><span>Nama</span><span>{car?.name || car?.nama || "-"}</span></div>
                <div><span>Plat</span><span>{car?.license_plate || car?.plat || "-"}</span></div>
                <div><span>Tipe</span><span>{car?.type || "-"}</span></div>
                <div><span>Transmisi</span><span>{car?.transmission || "-"}</span></div>
                <div><span>Bahan Bakar</span><span>{car?.fuel_type || "-"}</span></div>
                <div><span>Kapasitas</span><span>{car?.capacity || "-"}</span></div>
                <div><span>Harga/Hari</span><span>Rp{(car?.price_per_day || car?.harga || 0).toLocaleString("id-ID")}</span></div>
              </div>
            </div>
          </div>
          <div className="receipt-section">
            <div className="receipt-col">
              <h5><FaCalendarAlt className="me-2" />Detail Sewa</h5>
              <div className="receipt-info-list">
                <div><span>Tgl Pesan</span><span>{formatDate(order.order_date, "dd MMMM yyyy", true)}</span></div>
                <div><span>Ambil</span><span>{formatDate(order.pickup_date, "dd MMMM yyyy")}</span></div>
                <div><span>Kembali</span><span>{formatDate(order.return_date, "dd MMMM yyyy")}</span></div>
                <div><span>Durasi</span><span>{order.duration || "-"} hari</span></div>
              </div>
            </div>
            <div className="receipt-col">
              <h5><FaMoneyBillWave className="me-2" />Pembayaran</h5>
              <div className="receipt-info-list">
                <div>
                  <span>Metode</span>
                  <span className="d-flex align-items-center">
                    {getPaymentMethodIcon(order.payment_method)}
                    {getPaymentMethodName(order.payment_method)}
                  </span>
                </div>
                <div>
                  <span>Status</span>
                  <span>{getStatusBadge(order.payment_status)}</span>
                </div>
                <div>
                  <span>Pesanan</span>
                  <span>{getStatusBadge(order.status)}</span>
                </div>
                {order.payment_proof && (
                  <div>
                    <span>Bukti</span>
                    <span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setProofUrl(
                            order.payment_proof?.startsWith("http")
                              ? order.payment_proof
                              : `${window.location.origin}${order.payment_proof}`
                          );
                          setShowProofModal(true);
                        }}
                      >
                        <FaFileAlt className="me-1" /> Lihat
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="receipt-total-box">
            <div>
              <span>Total Pembayaran</span>
              <span className="total-amount">Rp{Number(order.total_price).toLocaleString("id-ID") || "0"}</span>
            </div>
            {order.payment_status === "paid" && (
              <div className="receipt-paid">
                <FaCheckCircle className="me-2" /> Pembayaran telah diterima
              </div>
            )}
          </div>
          {order.additional_notes && (
            <div className="receipt-section">
              <h5><FaFileAlt className="me-2" />Catatan Tambahan</h5>
              <div className="receipt-notes">{order.additional_notes}</div>
            </div>
          )}
          <div className="receipt-section">
            <h5><FaFileAlt className="me-2" />Syarat & Ketentuan</h5>
            <ol className="receipt-terms">
              <li>Kendaraan harus dikembalikan dalam kondisi seperti saat diambil</li>
              <li>Pembatalan kurang dari 24 jam dikenakan biaya 50% dari total sewa</li>
              <li>Keterlambatan pengembalian dikenakan biaya tambahan per jam</li>
              <li>Kerusakan akibat kelalaian pelanggan menjadi tanggung jawab pelanggan</li>
            </ol>
          </div>
        </div>
        <div className="receipt-footer">
          <div>
            Terima kasih telah menggunakan layanan <b>Rental Mobil Jaya</b>.<br />
            Hubungi kami di <b>0812-3456-7890</b> jika ada pertanyaan.
          </div>
          <div className="receipt-footer-note">
            Invoice ini sah dan diproses secara otomatis.
          </div>
        </div>
      </div>
      {/* Modal Bukti Pembayaran */}
      <div
        className={`modal fade ${showProofModal ? "show d-block" : ""}`}
        tabIndex="-1"
        style={{ background: showProofModal ? "rgba(0,0,0,0.5)" : "transparent" }}
        onClick={() => setShowProofModal(false)}
        aria-modal={showProofModal ? "true" : undefined}
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Bukti Pembayaran</h5>
              <button type="button" className="btn-close" onClick={() => setShowProofModal(false)}></button>
            </div>
            <div className="modal-body text-center">
              {proofUrl ? (
                <img src={proofUrl} alt="Bukti Pembayaran" className="img-fluid rounded shadow" />
              ) : (
                <div className="text-muted">Tidak ada bukti pembayaran.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Print Styles */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .receipt-page, .receipt-page * { visibility: visible; }
            .receipt-page { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; background: white !important; }
            .receipt-container { box-shadow: none !important; border: none !important; }
            .no-print, button { display: none !important; }
            .bg-primary { color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #0d6efd !important; }
            .bg-light { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .text-primary { color: #0d6efd !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            a { text-decoration: none !important; }
            @page { size: A4; margin: 10mm; }
          }
        `}
      </style>
    </div>
  );
};

export default OrderReceipt;