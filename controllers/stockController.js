const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const DamagedProduct = require('../models/DamagedProduct');
const { toEan13 } = require('../utils/barcodeGenerator');

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

    // Damaged returns are logged separately and never added back into
    // sellable inventory - the product's quantity is intentionally left
    // untouched here, unlike customer/supplier returns which do restock it.
    if (isReturn && returnType === 'damaged') {
      const damaged = await DamagedProduct.create({
        productId: product._id,
        employeeId: req.user._id,
        quantity: Number(quantity),
        note: note || '',
        referenceId: referenceId.trim(),
      });

      return res.status(201).json({ damaged, product });
    }

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

// Maps the free-text "Type" column in an imported sheet to how the row
// should be applied - mirrors the exact branches stockIn/stockOut use above,
// so a bulk-imported row behaves identically to typing it in by hand.
const TRANSACTION_TYPE_MAP = {
  'stock in': { action: 'in' },
  'stock out': { action: 'out' },
  'customer return': { action: 'in', isReturn: true, returnType: 'customer' },
  'supplier return': { action: 'in', isReturn: true, returnType: 'supplier' },
  'damaged return': { action: 'damaged', isReturn: true, returnType: 'damaged' },
};

// Only Type and Quantity actually drive what happens to a row; SKU/EAN just
// identify which product that is. Name/Brand/Pack Size/MRP/Expiry Date are
// accepted straight from a product export/import sheet so a user can hand us
// the same file they already have and just add a Type (+ Reference/Note)
// column - those descriptive fields are never written back to the product.
const REQUIRED_STOCK_IMPORT_COLUMNS = ['type', 'quantity'];

// @route POST /api/stock/import (admin only)
// Body: { rows: [{ sku?, ean?, type, quantity, referenceId?, note?, ... }, ...] }
// `type` must be one of the TRANSACTION_TYPE_MAP keys (case-insensitive).
// Each row is applied the same way its equivalent manual action would be:
// stock in/out adjust the product's quantity and log a Transaction, while a
// damaged return is logged to DamagedProduct only and never touches quantity.
const importStockTransactions = async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'No rows to import' });
    }

    const missingColumns = REQUIRED_STOCK_IMPORT_COLUMNS.filter(
      (col) => !rows.every((row) => Object.prototype.hasOwnProperty.call(row, col)),
    );
    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required column(s): ${missingColumns.join(', ')}`,
      });
    }

    const summary = { stockIn: 0, stockOut: 0, customerReturn: 0, supplierReturn: 0, damagedReturn: 0 };
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header row, +1 for 1-indexing

      const sku = String(row.sku ?? '').trim().toUpperCase();
      const eanRaw = String(row.ean ?? '').trim();
      const typeKey = String(row.type ?? '').trim().toLowerCase();
      const quantity = Number(row.quantity);
      const note = String(row.note ?? '').trim();
      const referenceId = String(row.referenceId ?? '').trim();

      if (!sku && !eanRaw) {
        errors.push({ row: rowNum, message: 'Missing SKU or EAN to identify the product' });
        continue;
      }

      const typeConfig = TRANSACTION_TYPE_MAP[typeKey];
      if (!typeConfig) {
        errors.push({
          row: rowNum,
          message: `Invalid type "${row.type}". Must be one of: Stock In, Stock Out, Customer Return, Supplier Return, Damaged Return`,
        });
        continue;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push({ row: rowNum, message: 'Invalid quantity' });
        continue;
      }

      if (typeConfig.isReturn && !referenceId) {
        errors.push({ row: rowNum, message: 'referenceId is required for returns' });
        continue;
      }

      // Look the product up by whichever identifier the sheet gave us - SKU
      // first (exact match, same as the rest of the app), EAN as a fallback
      // (normalized the same way the barcode scanner does).
      let product = null;
      if (sku) product = await Product.findOne({ sku });
      if (!product && eanRaw) {
        let ean;
        try {
          ean = toEan13(eanRaw);
        } catch {
          ean = eanRaw;
        }
        product = await Product.findOne({ ean });
      }
      if (!product) {
        errors.push({ row: rowNum, message: `No product found for SKU/EAN "${sku || eanRaw}"` });
        continue;
      }

      try {
        if (typeConfig.action === 'damaged') {
          await DamagedProduct.create({
            productId: product._id,
            employeeId: req.user._id,
            quantity,
            note,
            referenceId,
          });
          summary.damagedReturn += 1;
          continue;
        }

        const previousQuantity = product.quantity;

        if (typeConfig.action === 'out') {
          if (quantity > previousQuantity) {
            errors.push({
              row: rowNum,
              message: `Insufficient stock for "${product.sku}": only ${previousQuantity} units available`,
            });
            continue;
          }
          product.quantity = previousQuantity - quantity;
        } else {
          product.quantity = previousQuantity + quantity;
        }
        await product.save();

        await Transaction.create({
          productId: product._id,
          employeeId: req.user._id,
          type: typeConfig.action === 'out' ? 'OUT' : 'IN',
          quantity,
          previousQuantity,
          updatedQuantity: product.quantity,
          note,
          source: typeConfig.isReturn ? 'return' : 'purchase',
          returnType: typeConfig.isReturn ? typeConfig.returnType : null,
          referenceId: typeConfig.isReturn ? referenceId : '',
        });

        if (typeConfig.action === 'out') summary.stockOut += 1;
        else if (typeConfig.returnType === 'customer') summary.customerReturn += 1;
        else if (typeConfig.returnType === 'supplier') summary.supplierReturn += 1;
        else summary.stockIn += 1;
      } catch (err) {
        errors.push({ row: rowNum, message: err.message });
      }
    }

    const processedCount = Object.values(summary).reduce((a, b) => a + b, 0);
    res.status(processedCount > 0 ? 201 : 400).json({
      summary,
      processedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { stockIn, stockOut, importStockTransactions };
