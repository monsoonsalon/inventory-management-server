const express = require('express');
const router = express.Router();
const { getTransactions, getTransactionsSummary } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.get('/summary', protect, getTransactionsSummary);
router.get('/', protect, getTransactions);

module.exports = router;
