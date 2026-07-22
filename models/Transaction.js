const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['IN', 'OUT'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    previousQuantity: { type: Number, required: true },
    updatedQuantity: { type: Number, required: true },
    note: { type: String, trim: true, default: '' },
    source: { type: String, enum: ['purchase', 'return'], default: 'purchase' },
    returnType: {
      type: String,
      enum: ['customer', 'supplier', 'damaged', null],
      default: null,
    },
    referenceId: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
