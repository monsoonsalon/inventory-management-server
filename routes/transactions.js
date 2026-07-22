const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTransactions);

module.exports = router;
