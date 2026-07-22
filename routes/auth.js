const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', protect, roleCheck('admin'), register);
router.get('/me', protect, getMe);

module.exports = router;
