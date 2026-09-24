const express = require('express');
const router = express.Router();
const { getDamagedProducts } = require('../controllers/damagedController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getDamagedProducts);

module.exports = router;
