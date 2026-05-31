// backend/services/marketAnalysisService.js
// Provides market analysis, winners/losers, momentum tracking

const pino = require('pino');
const axios = require('axios');
const marketDataService = require('./marketDataService');
const marketHolidayManager = require('../utils/marketHolidayManager');

const logger = pino();

class MarketAnalysisService {
  constructor() {
    this.nseStocks = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'WIPRO.NS', 'AXISBANK.NS', 'HDFC.NS', 'ICICIBANK.NS', 'LT.NS', 'MARUTI.NS', 'BHARTIARTL.NS', 'ADANIGREEN.NS', 'BAJAJFINSV.NS', 'SUNPHARMA.NS', 'HINDUNILVR.NS', 'ITC.NS'];
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * Get market winners (top gainers by percentage)
   */
  async getMarketWinners(limit = 10) {
    try {
      const cacheKey = 'market_winners';
      if (this._isCached(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const prices = await marketDataService.getPricesBatch(this.nseStocks);
      const winners = prices
        .map(p => ({
          ticker: p.ticker,
          company: p.company || this._getCompanyName(p.ticker),
          currentPrice: p.price,
          change: p.change,
          changePercent: p.changePercent,
          high: p.high,
          low: p.low,
          volume: p.volume,
          momentum: this._calculateMomentum(p),
        }))
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
        .slice(0, limit);

      this._setCached(cacheKey, winners, 5); // 5 min cache
      return winners;
    } catch (error) {
      logger.error({ error: error.message }, 'getMarketWinners failed');
      throw error;
    }
  }

  /**
   * Get market losers (bottom losers by percentage)
   */
  async getMarketLosers(limit = 10) {
    try {
      const cacheKey = 'market_losers';
      if (this._isCached(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const prices = await marketDataService.getPricesBatch(this.nseStocks);
      const losers = prices
        .map(p => ({
          ticker: p.ticker,
          company: p.company || this._getCompanyName(p.ticker),
          currentPrice: p.price,
          change: p.change,
          changePercent: p.changePercent,
          high: p.high,
          low: p.low,
          volume: p.volume,
          momentum: this._calculateMomentum(p),
        }))
        .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
        .slice(0, limit);

      this._setCached(cacheKey, losers, 5); // 5 min cache
      return losers;
    } catch (error) {
      logger.error({ error: error.message }, 'getMarketLosers failed');
      throw error;
    }
  }

  /**
   * Get comprehensive market summary
   */
  async getMarketSummary() {
    try {
      const cacheKey = 'market_summary';
      if (this._isCached(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const marketStatus = marketHolidayManager.getMarketStatusInfo();
      const winners = await this.getMarketWinners(5);
      const losers = await this.getMarketLosers(5);

      const summary = {
        marketStatus,
        timestamp: new Date().toISOString(),
        dataDate: marketStatus.isOpen 
          ? new Date().toISOString().split('T')[0]
          : marketHolidayManager.getPreviousTradingDayInfo().date,
        winners,
        losers,
        topGainers: winners.slice(0, 3),
        topLosers: losers.slice(0, 3),
        totalAnalyzed: this.nseStocks.length,
      };

      // Add previous trading day info if market is closed
      if (!marketStatus.isOpen) {
        summary.previousTradingDay = marketHolidayManager.getPreviousTradingDayInfo();
        summary.nextTradingDay = marketHolidayManager.getNextTradingDayInfo();
      }

      this._setCached(cacheKey, summary, 5);
      return summary;
    } catch (error) {
      logger.error({ error: error.message }, 'getMarketSummary failed');
      throw error;
    }
  }

  /**
   * Get stock momentum analysis
   */
  async getStockMomentum(ticker) {
    try {
      const price = await marketDataService.getLatestPrice(ticker);
      if (!price) throw new Error(`Price not found for ${ticker}`);

      const momentum = this._calculateMomentum(price);
      const sentiment = this._calculateSentiment(price);

      return {
        ticker,
        company: price.company || this._getCompanyName(ticker),
        currentPrice: price.price,
        change: price.change,
        changePercent: price.changePercent,
        momentum,
        sentiment,
        technicalSignals: this._generateTechnicalSignals(price, momentum),
        volatility: this._calculateVolatility(price),
        support: (price.low || price.price * 0.98),
        resistance: (price.high || price.price * 1.02),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error: error.message, ticker }, 'getStockMomentum failed');
      throw error;
    }
  }

  /**
   * Analyze why a stock gained/lost momentum
   */
  async analyzeStockMomentumShift(ticker) {
    try {
      const momentum = await this.getStockMomentum(ticker);
      const sentimentAnalysis = await this._fetchStockSentiment(ticker);

      return {
        ticker,
        momentum,
        sentimentAnalysis,
        factors: {
          technical: this._identifyTechnicalFactors(momentum),
          sentiment: this._identifySentimentFactors(sentimentAnalysis),
          market: this._identifyMarketFactors(),
        },
        summary: this._generateMomentumSummary(momentum, sentimentAnalysis),
      };
    } catch (error) {
      logger.error({ error: error.message, ticker }, 'analyzeStockMomentumShift failed');
      throw error;
    }
  }

  /**
   * Calculate momentum score (0-100)
   */
  _calculateMomentum(priceData) {
    const changePercent = priceData.changePercent || 0;
    const volume = priceData.volume || 0;
    const volumeImpact = volume > 1000000 ? 10 : 0;
    
    // Momentum = change% + volume boost
    let momentum = Math.max(-100, Math.min(100, changePercent)) + volumeImpact;
    return {
      score: momentum,
      direction: momentum > 5 ? 'bullish' : momentum < -5 ? 'bearish' : 'neutral',
      strength: Math.abs(momentum) > 20 ? 'strong' : Math.abs(momentum) > 10 ? 'moderate' : 'weak',
    };
  }

  /**
   * Calculate sentiment (bullish, bearish, neutral)
   */
  _calculateSentiment(priceData) {
    const changePercent = priceData.changePercent || 0;
    if (changePercent > 2) return 'strong_bullish';
    if (changePercent > 0.5) return 'bullish';
    if (changePercent < -2) return 'strong_bearish';
    if (changePercent < -0.5) return 'bearish';
    return 'neutral';
  }

  /**
   * Generate technical signals
   */
  _generateTechnicalSignals(priceData, momentum) {
    const signals = [];
    const changePercent = priceData.changePercent || 0;

    if (changePercent > 3) signals.push('Strong Buy Signal');
    if (changePercent > 1) signals.push('Buy Signal');
    if (changePercent < -3) signals.push('Strong Sell Signal');
    if (changePercent < -1) signals.push('Sell Signal');

    if (priceData.volume && priceData.volume > 1000000) signals.push('High Volume');
    if (priceData.price > priceData.high * 0.99) signals.push('Near 52W High');
    if (priceData.price < priceData.low * 1.01) signals.push('Near 52W Low');

    return signals;
  }

  /**
   * Calculate volatility (0-100)
   */
  _calculateVolatility(priceData) {
    const high = priceData.high || priceData.price;
    const low = priceData.low || priceData.price;
    const range = (high - low) / low * 100;
    return Math.min(100, range * 10);
  }

  /**
   * Fetch sentiment from news/social data (placeholder)
   */
  async _fetchStockSentiment(ticker) {
    try {
      // Placeholder: In production, integrate with news API
      return {
        newsCount: 0,
        positiveSentiment: 50,
        negativeSentiment: 30,
        neutralSentiment: 20,
        trendingTopics: [],
      };
    } catch (error) {
      logger.warn({ ticker }, 'Could not fetch sentiment data');
      return null;
    }
  }

  /**
   * Identify technical factors
   */
  _identifyTechnicalFactors(momentum) {
    const factors = [];
    if (momentum.score > 20) factors.push('Strong upward momentum');
    if (momentum.score < -20) factors.push('Strong downward momentum');
    if (momentum.strength === 'strong') factors.push('High volatility');
    return factors;
  }

  /**
   * Identify sentiment factors
   */
  _identifySentimentFactors(sentiment) {
    const factors = [];
    if (!sentiment) return factors;
    if (sentiment.positiveSentiment > 50) factors.push('Positive news sentiment');
    if (sentiment.negativeSentiment > 50) factors.push('Negative news sentiment');
    if (sentiment.newsCount > 10) factors.push('High media attention');
    return factors;
  }

  /**
   * Identify market-wide factors
   */
  _identifyMarketFactors() {
    return [
      'Market opening/closing volatility',
      'NSE index movement',
      'Sector rotation',
      'Global market sentiment',
    ];
  }

  /**
   * Generate momentum summary narrative
   */
  _generateMomentumSummary(momentum, sentiment) {
    let summary = '';
    
    if (momentum.direction === 'bullish') {
      summary = `Stock is trading in ${momentum.strength} bullish territory with positive momentum.`;
    } else if (momentum.direction === 'bearish') {
      summary = `Stock is trading in ${momentum.strength} bearish territory with negative momentum.`;
    } else {
      summary = 'Stock is trading sideways with neutral momentum.';
    }

    return summary;
  }

  /**
   * Get company name from ticker
   */
  _getCompanyName(ticker) {
    const names = {
      'RELIANCE.NS': 'Reliance Industries',
      'TCS.NS': 'Tata Consultancy Services',
      'INFY.NS': 'Infosys',
      'WIPRO.NS': 'Wipro',
      'AXISBANK.NS': 'Axis Bank',
      'HDFC.NS': 'HDFC Bank',
      'ICICIBANK.NS': 'ICICI Bank',
      'LT.NS': 'Larsen & Toubro',
      'MARUTI.NS': 'Maruti Suzuki',
      'BHARTIARTL.NS': 'Bharti Airtel',
      'ADANIGREEN.NS': 'Adani Green',
      'BAJAJFINSV.NS': 'Bajaj Finserv',
      'SUNPHARMA.NS': 'Sun Pharma',
      'HINDUNILVR.NS': 'Hindustan Unilever',
      'ITC.NS': 'ITC Ltd',
    };
    return names[ticker] || ticker;
  }

  /**
   * Cache helpers
   */
  _isCached(key) {
    return this.cache.has(key) && this.cacheExpiry.get(key) > Date.now();
  }

  _setCached(key, value, expiryMinutes = 5) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + expiryMinutes * 60 * 1000);
  }
}

module.exports = new MarketAnalysisService();
