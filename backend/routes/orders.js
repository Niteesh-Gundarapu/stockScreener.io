const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { validateRequest } = require('../middleware/security');
const orderService = require('../services/orderService');

// Place an order (protected)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { portfolioId, ticker, side, type, quantity, limitPrice, stopPrice, trailingPct, leverage, isIntraday, linkedOrderId } = req.body;
    const result = await orderService.placeOrder({ userId, portfolioId, ticker, side, type, quantity, limitPrice, stopPrice, trailingPct, leverage, isIntraday, linkedOrderId });
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get orders for user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = await orderService.getOrdersForUser(userId);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
