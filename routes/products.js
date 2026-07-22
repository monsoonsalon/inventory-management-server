const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/', protect, getProducts);
router.get('/:id', protect, getProductById);
router.post('/', protect, roleCheck('admin'), createProduct);
router.put('/:id', protect, roleCheck('admin'), updateProduct);
router.delete('/:id', protect, roleCheck('admin'), deleteProduct);

module.exports = router;
