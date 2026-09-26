const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    ean: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      required: true,
    },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 10 },
    packSize: { type: String, required: true, trim: true },
    mrp: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock',
    },
  },
  { timestamps: true }
);

// Auto-calculate status based on quantity vs minimumStock
productSchema.pre('save', function (next) {
  if (this.quantity <= 0) {
    this.status = 'Out of Stock';
  } else if (this.quantity <= this.minimumStock) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  next();
});

// Also recalc on findOneAndUpdate flows that pass quantity/minimumStock
productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  next();
});

module.exports = mongoose.model('Product', productSchema);
