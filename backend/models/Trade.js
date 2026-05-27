const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  ticker: { type: String, required: true },
  type: { type: String, enum: ['BUY', 'SELL'], required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  notes: String
});

module.exports = mongoose.model('Trade', tradeSchema);
