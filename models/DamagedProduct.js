const mongoose = require('mongoose');

const damagedProductSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, default: '' },
    referenceId: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

damagedProductSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DamagedProduct', damagedProductSchema);
