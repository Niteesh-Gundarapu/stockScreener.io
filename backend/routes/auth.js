// backend/routes/auth.js
// Authentication routes (register, login)

const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/security');
const { authenticateJWT } = require('../middleware/auth');
const { register, login, getProfile } = require('../controllers/authController');

// Register new user
router.post('/register', validateRequest('register'), register);

// Login
router.post('/login', validateRequest('login'), login);

// Get current user profile (protected)
router.get('/profile', authenticateJWT, getProfile);

module.exports = router;
