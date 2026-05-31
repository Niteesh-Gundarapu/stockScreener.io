const express = require('express');
const router = express.Router();
const MarketService = require('../services/marketService');
const RecommendationService = require('../services/recommendationService');

const marketService = new MarketService();
const recommendationService = new RecommendationService();

// Get pre-market snapshot for tracked tickers
router.get('/pre-market', async (req, res) => {
  try {
    const tickers = req.query.tickers
      ? req.query.tickers.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;

    const snapshot = await marketService.getPreMarketSnapshot(tickers);
    res.json({ success: true, snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Perform a deep market analysis for check / avoid signals
router.post('/deep-analysis', async (req, res) => {
  try {
    const tickers = Array.isArray(req.body.tickers) && req.body.tickers.length
      ? req.body.tickers
      : undefined;

    const analysis = await marketService.getDeepMarketAnalysis(tickers);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate daily check / avoid recommendations and deep market signals
router.post('/recommendations/daily', async (req, res) => {
  try {
    const tickers = Array.isArray(req.body.tickers) && req.body.tickers.length
      ? req.body.tickers
      : undefined;

    const analysis = await marketService.getDeepMarketAnalysis(tickers);
    const recommendations = await recommendationService.generateSmartRecommendations(
      tickers || analysis.deepMarket.map(item => item.ticker),
      analysis.avoidList
    );

    res.json({
      success: true,
      analysis,
      recommendations
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
