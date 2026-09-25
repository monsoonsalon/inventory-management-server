const Product = require("../models/Product");
const { toEan13 } = require("../utils/barcodeGenerator");

// @route GET /api/products?search=&status=
const getProducts = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      query.status = status;
    }

    const products = await Product.find(query).sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/products/ean/:ean - exact-match lookup used by the barcode scanner
const getProductByEan = async (req, res) => {
  try {
    const rawEan = req.params.ean?.trim();
    if (!rawEan) return res.status(400).json({ message: "EAN is required" });

    let ean;
    try {
      ean = toEan13(rawEan);
    } catch {
      ean = rawEan;
    }

    const product = await Product.findOne({ ean });
    if (!product)
      return res
        .status(404)
        .json({ message: "No product found for this barcode" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/products (admin only)
const createProduct = async (req, res) => {
  try {
    const { name, sku, ean, category, quantity, minimumStock } = req.body;
    if (!name || !sku || !ean || !category) {
      return res
        .status(400)
        .json({ message: "name, sku, ean and category are required" });
    }

    let normalizedEan;
    try {
      normalizedEan = toEan13(ean);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const product = await Product.create({
      name,
      sku,
      ean: normalizedEan,
      category,
      quantity: quantity ?? 0,
      minimumStock: minimumStock ?? 10,
    });

    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "SKU";
      return res
        .status(400)
        .json({ message: `A product with this ${field} already exists` });
    }
    res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/products/:id (admin only)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, sku, ean, category, quantity, minimumStock } = req.body;
    if (name !== undefined) product.name = name;
    if (sku !== undefined) product.sku = sku;
    if (ean !== undefined) {
      if (!ean.trim())
        return res.status(400).json({ message: "EAN is required" });
      try {
        product.ean = toEan13(ean);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }
    if (category !== undefined) product.category = category;
    if (quantity !== undefined) product.quantity = quantity;
    if (minimumStock !== undefined) product.minimumStock = minimumStock;

    await product.save(); // triggers pre-save status recalculation
    res.json(product);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "SKU";
      return res
        .status(400)
        .json({ message: `A product with this ${field} already exists` });
    }
    res.status(500).json({ message: err.message });
  }
};

const REQUIRED_IMPORT_COLUMNS = [
  "name",
  "sku",
  "ean",
  "category",
  "quantity",
  "minimumStock",
];

// @route POST /api/products/import (admin only)
// Body: { rows: [{ name, sku, ean?, category, quantity, minimumStock }, ...] }
// `rows` come from the client's Excel parse; every row is expected to carry
// all of REQUIRED_IMPORT_COLUMNS as keys (even if a value is blank) - that's
// what lets us tell "column missing from the sheet" apart from "value left
// blank in one row" and report a clear top-level error for the former.
const importProducts = async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows to import" });
    }

    const missingColumns = REQUIRED_IMPORT_COLUMNS.filter(
      (col) =>
        !rows.every((row) => Object.prototype.hasOwnProperty.call(row, col)),
    );
    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required column(s): ${missingColumns.join(", ")}`,
      });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header row, +1 for 1-indexing

      const name = String(row.name ?? "").trim();
      const sku = String(row.sku ?? "").trim();
      const category = String(row.category ?? "").trim();
      const ean = String(row.ean ?? "").trim();
      const quantity =
        row.quantity === "" || row.quantity == null ? 0 : Number(row.quantity);
      const minimumStock =
        row.minimumStock === "" || row.minimumStock == null
          ? 10
          : Number(row.minimumStock);

      if (!name || !sku || !ean || !category) {
        errors.push({
          row: rowNum,
          message: "Missing name, sku, ean, or category",
        });
        continue;
      }
      if (Number.isNaN(quantity) || quantity < 0) {
        errors.push({ row: rowNum, message: "Invalid quantity" });
        continue;
      }
      if (Number.isNaN(minimumStock) || minimumStock < 0) {
        errors.push({ row: rowNum, message: "Invalid minimum stock" });
        continue;
      }

      let normalizedEan;
      try {
        normalizedEan = toEan13(ean);
      } catch (err) {
        errors.push({ row: rowNum, message: err.message });
        continue;
      }

      try {
        const product = await Product.create({
          name,
          sku,
          ean: normalizedEan,
          category,
          quantity,
          minimumStock,
        });
        created.push(product);
      } catch (err) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || "sku";
          errors.push({
            row: rowNum,
            message: `Duplicate ${field}: "${field === "ean" ? ean : sku}"`,
          });
        } else {
          errors.push({ row: rowNum, message: err.message });
        }
      }
    }

    res.status(created.length > 0 ? 201 : 400).json({
      createdCount: created.length,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/products/:id (admin only)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductByEan,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
};
