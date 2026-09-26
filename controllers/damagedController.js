const DamagedProduct = require('../models/DamagedProduct');

// @route GET /api/damaged
const getDamagedProducts = async (req, res) => {
  try {
    const items = await DamagedProduct.find()
      .populate('productId', 'name sku ean category packSize mrp expiryDate')
      .populate('employeeId', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDamagedProducts };
