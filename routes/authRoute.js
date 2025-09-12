const express = require("express");
const router = express.Router();
require("dotenv").config(); // Sesuaikan path-nya

const loginController = require("../controllers/auth/loginController");
const registerController = require("../controllers/auth/registerController");
const userController = require("../controllers/userControllers"); // ✅ Perbaikan di sini

// Route untuk login dan register
router.post("/login", loginController.loginUser);
router.post("/register", registerController.registerUser);

// Route untuk user CRUD
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
