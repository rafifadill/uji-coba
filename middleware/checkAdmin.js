module.exports = (req, res, next) => {
  // Pastikan req.user sudah diisi oleh middleware auth/JWT
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Forbidden: Admin only" });
};