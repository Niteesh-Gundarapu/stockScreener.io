const express = require('express');
const router = express.Router();
const PortfolioService = require('../services/portfolioService');

const portfolioService = new PortfolioService();

// Create portfolio
router.post('/create', async (req, res) => {
  try {
    const { userId, username } = req.body;
    const portfolio = await portfolioService.createPortfolio(userId, username);
    res.json({ success: true, portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get portfolio
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolio(req.params.userId);
    res.json({ success: true, portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buy stock
router.post('/buy', async (req, res) => {
  try {
    const { userId, ticker, quantity, currentPrice } = req.body;
    const result = await portfolioService.buyStock(userId, ticker, quantity, currentPrice);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Sell stock
router.post('/sell', async (req, res) => {
  try {
    const { userId, ticker, quantity, currentPrice } = req.body;
    const result = await portfolioService.sellStock(userId, ticker, quantity, currentPrice);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get trade history
router.get('/:userId/trades', async (req, res) => {
  try {
    const trades = await portfolioService.getTradeHistory(req.params.userId, req.query.limit || 50);
    res.json({ success: true, trades });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get portfolio stats
router.get('/:userId/stats', async (req, res) => {
  try {
    const stats = await portfolioService.getPortfolioStats(req.params.userId);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create price alert
router.post('/alert/create', async (req, res) => {
  try {
    const { userId, ticker, targetPrice, alertType } = req.body;
    const alert = await portfolioService.createPriceAlert(userId, ticker, targetPrice, alertType);
    res.json({ success: true, alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get price alerts
router.get('/:userId/alerts', async (req, res) => {
  try {
    const alerts = await portfolioService.getPriceAlerts(req.params.userId);
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
