// backend/routes/marketAnalysis.js
// Comprehensive market analysis and end-of-day winners/losers routes

const express = require('express');
const router = express.Router();
const marketAnalysisService = require('../services/marketAnalysisService');
const marketHolidayManager = require('../utils/marketHolidayManager');
const { optionalAuth } = require('../middleware/auth');

const pino = require('pino');
const logger = pino();

/**
 * GET /api/market-analysis/status
 * Get current market status (open/closed, holiday info)
 */
router.get('/status', (req, res) => {
  try {
    const status = marketHolidayManager.getMarketStatusInfo();
    const response = {
      success: true,
      marketStatus: status,
      timestamp: new Date().toISOString(),
    };

    if (!status.isOpen) {
      response.previousTradingDay = marketHolidayManager.getPreviousTradingDayInfo();
      response.nextTradingDay = marketHolidayManager.getNextTradingDayInfo();
      response.message = 'Market is closed. Previous trading day data available.';
    } else {
      response.message = 'Market is open.';
    }

    res.json(response);
  } catch (error) {
    logger.error({ error: error.message }, 'Market status failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/summary
 * Get comprehensive market summary with winners and losers
 */
router.get('/summary', optionalAuth, async (req, res) => {
  try {
    const summary = await marketAnalysisService.getMarketSummary();
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    res.json({
      success: true,
      marketStatus,
      summary,
      dataSource: marketStatus.isOpen ? 'live' : 'previous_trading_day',
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Market summary failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/winners
 * Get top market gainers (winners)
 */
router.get('/winners', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 10), 20);
    const winners = await marketAnalysisService.getMarketWinners(limit);
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    res.json({
      success: true,
      marketStatus,
      winners,
      count: winners.length,
      dataType: marketStatus.isOpen ? 'live' : 'previous_trading_day',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get winners failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/losers
 * Get top market losers
 */
router.get('/losers', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 10), 20);
    const losers = await marketAnalysisService.getMarketLosers(limit);
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    res.json({
      success: true,
      marketStatus,
      losers,
      count: losers.length,
      dataType: marketStatus.isOpen ? 'live' : 'previous_trading_day',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get losers failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/end-of-day
 * Get end-of-day market report (winners, losers, movers)
 */
router.get('/end-of-day', optionalAuth, async (req, res) => {
  try {
    const winners = await marketAnalysisService.getMarketWinners(10);
    const losers = await marketAnalysisService.getMarketLosers(10);
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    // Calculate aggregate stats
    const avgGain = winners.reduce((sum, w) => sum + (w.changePercent || 0), 0) / Math.max(winners.length, 1);
    const avgLoss = losers.reduce((sum, l) => sum + (l.changePercent || 0), 0) / Math.max(losers.length, 1);

    const report = {
      success: true,
      marketStatus,
      date: new Date().toISOString().split('T')[0],
      isPreviousDay: !marketStatus.isOpen,
      summary: {
        topGainers: winners.slice(0, 5),
        topLosers: losers.slice(0, 5),
        gainersCount: winners.length,
        losersCount: losers.length,
        averageGain: avgGain.toFixed(2),
        averageLoss: avgLoss.toFixed(2),
      },
      detailedWinners: winners,
      detailedLosers: losers,
      timestamp: new Date().toISOString(),
    };

    // Add market closed info if applicable
    if (!marketStatus.isOpen) {
      report.marketClosedInfo = {
        reason: marketStatus.reason,
        message: marketStatus.message,
        previousTradingDay: marketHolidayManager.getPreviousTradingDayInfo(),
        nextTradingDay: marketHolidayManager.getNextTradingDayInfo(),
      };
    }

    res.json(report);
  } catch (error) {
    logger.error({ error: error.message }, 'End of day report failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/momentum/:ticker
 * Get momentum analysis for a specific stock
 */
router.get('/momentum/:ticker', optionalAuth, async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const momentum = await marketAnalysisService.getStockMomentum(ticker);
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    res.json({
      success: true,
      marketStatus,
      momentum,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error: error.message, ticker: req.params.ticker }, 'Momentum analysis failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/momentum-shift/:ticker
 * Analyze why a stock gained or lost momentum
 */
router.get('/momentum-shift/:ticker', optionalAuth, async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const analysis = await marketAnalysisService.analyzeStockMomentumShift(ticker);
    const marketStatus = marketHolidayManager.getMarketStatusInfo();

    res.json({
      success: true,
      marketStatus,
      analysis,
      explanation: this._generateExplanation(analysis),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error: error.message, ticker: req.params.ticker }, 'Momentum shift analysis failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market-analysis/market-status-with-data
 * Get market status along with categorized data (today/previous/next)
 */
router.get('/market-status-with-data', optionalAuth, async (req, res) => {
  try {
    const marketStatus = marketHolidayManager.getMarketStatusInfo();
    const summary = await marketAnalysisService.getMarketSummary();

    let response = {
      success: true,
      marketStatus,
      timestamp: new Date().toISOString(),
    };

    if (marketStatus.isOpen) {
      // Market is open - show today's data
      response.today = {
        data: summary,
        label: 'Today\'s Market Data',
        isPrimary: true,
      };
      response.previous = {
        label: 'Previous Trading Day Data',
        info: marketHolidayManager.getPreviousTradingDayInfo(),
        available: false,
      };
      response.next = {
        label: 'Tomorrow\'s Expectations',
        info: marketHolidayManager.getNextTradingDayInfo(),
        available: false,
      };
    } else {
      // Market is closed - show previous trading day as primary
      const prevDay = marketHolidayManager.getPreviousTradingDayInfo();
      const nextDay = marketHolidayManager.getNextTradingDayInfo();

      response.today = {
        label: 'Today',
        status: marketStatus.message,
        isPrimary: false,
      };
      response.previous = {
        data: summary,
        label: `Previous Trading Day (${prevDay.dateFormatted})`,
        info: prevDay,
        isPrimary: true,
        highlight: true,
      };
      response.next = {
        label: `Next Trading Day (${nextDay.dateFormatted})`,
        info: nextDay,
        isPrimary: false,
        alert: 'Monitor for next day opportunities',
      };
    }

    res.json(response);
  } catch (error) {
    logger.error({ error: error.message }, 'Market status with data failed');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper to generate explanation
 */
function _generateExplanation(analysis) {
  if (!analysis || !analysis.summary) return '';
  return analysis.summary;
}

module.exports = router;
