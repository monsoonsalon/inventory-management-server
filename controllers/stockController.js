const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

// NOTE: Multi-document transactions require MongoDB to run as a replica set.
// A standalone local `mongod` does not support sessions, so these operations
// are done as sequential writes instead. This is fine for a single-server
// deployment; if you move to a replica set / Atlas, wrapping the two writes
// below in a session.withTransaction() block is a safe upgrade.

// @route POST /api/stock/in
const RETURN_TYPES = ['customer', 'supplier', 'damaged'];
const stockIn = async (req, res) => {
  try {
    const { productId, quantity, note, source, returnType, referenceId } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'productId and a positive quantity are required' });
    }

    const isReturn = source === 'return';

    if (isReturn && !RETURN_TYPES.includes(returnType)) {
      return res.status(400).json({
        message: `returnType is required for returns and must be one of: ${RETURN_TYPES.join(', ')}`,
      });
    }
    if (isReturn && !referenceId?.trim()) {
      return res.status(400).json({ message: 'referenceId is required for returns' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const previousQuantity = product.quantity;
    product.quantity = previousQuantity + Number(quantity);
    await product.save();

    const transaction = await Transaction.create({
      productId: product._id,
      employeeId: req.user._id,
      type: 'IN',
      quantity: Number(quantity),
      previousQuantity,
      updatedQuantity: product.quantity,
      note: note || '',
      source: isReturn ? 'return' : 'purchase',
      returnType: isReturn ? returnType : null,
      referenceId: isReturn ? referenceId.trim() : '',
    });

    res.status(201).json({ transaction, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/stock/out
const stockOut = async (req, res) => {
  try {
    const { productId, quantity, note } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'productId and a positive quantity are required' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const previousQuantity = product.quantity;
    if (Number(quantity) > previousQuantity) {
      return res
        .status(400)
        .json({ message: `Insufficient stock: only ${previousQuantity} units available` });
    }

    product.quantity = previousQuantity - Number(quantity);
    await product.save();

    const transaction = await Transaction.create({
      productId: product._id,
      employeeId: req.user._id,
      type: 'OUT',
      quantity: Number(quantity),
      previousQuantity,
      updatedQuantity: product.quantity,
      note: note || '',
    });

    res.status(201).json({ transaction, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { stockIn, stockOut };
