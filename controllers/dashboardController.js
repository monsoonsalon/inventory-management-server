const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

// @route GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      stockAgg,
      lowStockCount,
      todayIn,
      todayOut,
      last7Days,
      topProducts,
    ] = await Promise.all([
      Product.countDocuments(),

      Product.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),

      Product.countDocuments({ status: { $in: ['Low Stock', 'Out of Stock'] } }),

      Transaction.aggregate([
        { $match: { type: 'IN', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),

      Transaction.aggregate([
        { $match: { type: 'OUT', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),

      Transaction.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$type',
            },
            total: { $sum: '$quantity' },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),

      Product.find().sort({ quantity: -1 }).limit(10).select('name sku quantity'),
    ]);

    // Reshape last7Days into [{ date, in, out }]
    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { date: key, in: 0, out: 0 };
    }
    last7Days.forEach((entry) => {
      const { date, type } = entry._id;
      if (dayMap[date]) {
        dayMap[date][type === 'IN' ? 'in' : 'out'] = entry.total;
      }
    });

    res.json({
      totalProducts,
      totalAvailableStock: stockAgg[0]?.total || 0,
      lowStockCount,
      stockInToday: todayIn[0]?.total || 0,
      stockOutToday: todayOut[0]?.total || 0,
      last7Days: Object.values(dayMap),
      topProducts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDashboard };
