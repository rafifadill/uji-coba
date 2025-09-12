// backend/utils/priceCalculator.js

/**
 * Menghitung total harga sewa mobil
 * @param {number} pricePerDay - Harga per hari
 * @param {Date} pickupDate - Tanggal pengambilan
 * @param {Date} returnDate - Tanggal pengembalian
 * @returns {number} Total harga sewa
 */
function calculateTotalPrice(pricePerDay, pickupDate, returnDate) {
    const diffTime = Math.abs(returnDate - pickupDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return pricePerDay * diffDays;
  }
  
  /**
   * Memeriksa ketersediaan mobil
   * @param {Object} mobil - Data mobil
   * @param {Date} pickupDate - Tanggal pengambilan
   * @param {Date} returnDate - Tanggal pengembalian
   * @returns {boolean} True jika tersedia, false jika tidak
   */
  function checkAvailability(mobil, pickupDate, returnDate) {
    // Implementasi logika pengecekan ketersediaan
    // Contoh sederhana:
    return mobil.status === 'available';
  }
  
  module.exports = {
    calculateTotalPrice,
    checkAvailability
  };