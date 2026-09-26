const express = require('express');
const router = express.Router();
const { stockIn, stockOut, importStockTransactions } = require('../controllers/stockController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.post('/in', protect, stockIn);
router.post('/out', protect, stockOut);
router.post('/import', protect, roleCheck('admin'), importStockTransactions);

module.exports = router;
