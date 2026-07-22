const Transaction = require('../models/Transaction');

// @route GET /api/transactions?page=&limit=&productId=&type=&dateFrom=&dateTo=
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, type, dateFrom, dateTo } = req.query;

    const query = {};
    if (productId) query.productId = productId;
    if (type) query.type = type;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('productId', 'name sku')
        .populate('employeeId', 'name email')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Transaction.countDocuments(query),
    ]);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTransactions };
