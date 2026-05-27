const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');

const analyticsService = new AnalyticsService();

// Get consecutive streaks
router.get('/streaks/:ticker', async (req, res) => {
  try {
    const streaks = await analyticsService.calculateConsecutiveStreaks(req.params.ticker);
    res.json({ success: true, streaks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get most active stocks
router.post('/most-active', async (req, res) => {
  try {
    const { tickers, timeframe } = req.body;
    const active = await analyticsService.getMostActiveStocks(tickers, timeframe || '1d');
    res.json({ success: true, active });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get why analysis
router.get('/why-analysis/:ticker', async (req, res) => {
  try {
    const analysis = await analyticsService.getWhyAnalysis(req.params.ticker);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get RSI
router.get('/rsi/:ticker', async (req, res) => {
  try {
    const rsi = await analyticsService.calculateRSI(req.params.ticker);
    res.json({ success: true, rsi });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate avoid list
router.post('/avoid-list', async (req, res) => {
  try {
    const { stocks } = req.body;
    const avoidList = analyticsService.generateAvoidList(stocks);
    res.json({ success: true, avoidList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
