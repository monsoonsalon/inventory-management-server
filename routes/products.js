const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  getProductByEan,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
} = require("../controllers/productController");
const { protect } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

router.get("/", protect, getProducts);
router.get("/ean/:ean", protect, getProductByEan);
router.get("/:id", protect, getProductById);
router.post("/", protect, roleCheck("admin"), createProduct);
router.post("/import", protect, roleCheck("admin"), importProducts);
router.put("/:id", protect, roleCheck("admin"), updateProduct);
router.delete("/:id", protect, roleCheck("admin"), deleteProduct);

module.exports = router;
