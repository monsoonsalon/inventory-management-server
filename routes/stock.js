const express = require('express');
const router = express.Router();
const { stockIn, stockOut } = require('../controllers/stockController');
const { protect } = require('../middleware/auth');

router.post('/in', protect, stockIn);
router.post('/out', protect, stockOut);

module.exports = router;
