const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  ticker: { type: String, required: true, index: true },
  targetPrice: { type: Number, required: true },
  alertType: { type: String, enum: ['ABOVE', 'BELOW'], default: 'ABOVE' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  triggeredAt: Date,
  notified: { type: Boolean, default: false }
});

module.exports = mongoose.model('PriceAlert', priceAlertSchema);
