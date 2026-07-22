const Product = require('../models/Product');

// @route GET /api/products?search=&status=
const getProducts = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
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
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/products (admin only)
const createProduct = async (req, res) => {
  try {
    const { name, sku, category, quantity, minimumStock } = req.body;
    if (!name || !sku || !category) {
      return res.status(400).json({ message: 'name, sku and category are required' });
    }

    const product = await Product.create({
      name,
      sku,
      category,
      quantity: quantity ?? 0,
      minimumStock: minimumStock ?? 10,
    });

    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A product with this SKU already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/products/:id (admin only)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, sku, category, quantity, minimumStock } = req.body;
    if (name !== undefined) product.name = name;
    if (sku !== undefined) product.sku = sku;
    if (category !== undefined) product.category = category;
    if (quantity !== undefined) product.quantity = quantity;
    if (minimumStock !== undefined) product.minimumStock = minimumStock;

    await product.save(); // triggers pre-save status recalculation
    res.json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A product with this SKU already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/products/:id (admin only)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
