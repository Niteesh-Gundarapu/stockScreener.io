const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  cash: { type: Number, default: 100000 },
  positions: [
    {
      ticker: String,
      quantity: Number,
      avgPrice: Number,
      currentPrice: Number,
      gainLoss: Number,
      gainLossPercent: Number,
      addedAt: { type: Date, default: Date.now }
    }
  ],
  totalValue: { type: Number, default: 100000 },
  totalGain: { type: Number, default: 0 },
  totalGainPercent: { type: Number, default: 0 },
  totalInvested: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
