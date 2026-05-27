const express = require('express');
const router = express.Router();
const RecommendationService = require('../services/recommendationService');

const recommendationService = new RecommendationService();

// Get smart recommendations
router.post('/smart', async (req, res) => {
  try {
    const { tickers, avoidList } = req.body;
    const recommendations = await recommendationService.generateSmartRecommendations(tickers, avoidList || []);
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
