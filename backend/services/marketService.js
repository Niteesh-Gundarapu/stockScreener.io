const { getYahooFinance } = require('../utils/yahooClient');
const AnalyticsService = require('./analyticsService');
const { getNifty50Symbols, getRandomSymbols } = require('../utils/niftySymbols');

class MarketService {
  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  /**
   * Returns a dynamic set of NSE tickers.
   * If explicit tickers are passed, uses those.
   * Otherwise uses the Nifty 50 symbol pool — no hardcoded prices.
   */
  _resolveSymbols(tickers) {
    if (Array.isArray(tickers) && tickers.length > 0) {
      return tickers.map(t => t.trim().toUpperCase());
    }
    // Use top 10 Nifty 50 for fast default premarket snapshot
    return getNifty50Symbols().slice(0, 10);
  }

  async _fetchQuote(ticker) {
    const yahooFinance = await getYahooFinance();
    const quote = await yahooFinance.quote(ticker);
    return quote;
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getQuotes(tickers = []) {
    const symbols = this._resolveSymbols(tickers);
    const results = [];

    for (let i = 0; i < symbols.length; i++) {
      const ticker = symbols[i];
      try {
        const quote = await this._fetchQuote(ticker);
        if (quote && quote.regularMarketPrice) {
          results.push({ ticker, quote });
        }
      } catch (error) {
        console.error(`Failed to fetch quote for ${ticker}:`, error.message);
      }

      if (i < symbols.length - 1) {
        await this.sleep(200); // slight throttle to avoid rate limits
      }
    }

    return results;
  }

  async getPreMarketSnapshot(tickers = []) {
    const quotes = await this.getQuotes(tickers);

    return quotes.map(({ ticker, quote }) => {
      const preMarketPrice = quote.preMarketPrice ?? null;
      const previousClose = quote.regularMarketPreviousClose ?? quote.previousClose ?? null;
      const preMarketSignal = preMarketPrice !== null && previousClose !== null
        ? preMarketPrice > previousClose ? 'UP'
        : preMarketPrice < previousClose ? 'DOWN'
        : 'FLAT'
        : 'UNAVAILABLE';

      const preMarketGapPercent = preMarketPrice !== null && previousClose
        ? ((preMarketPrice - previousClose) / previousClose) * 100
        : 0;

      return {
        ticker,
        company: quote.longName || quote.shortName || ticker,
        exchange: quote.exchange || quote.fullExchangeName || 'NSE',
        preMarketPrice,
        preMarketChange: quote.preMarketChange ?? 0,
        preMarketChangePercent: quote.preMarketChangePercent ?? 0,
        preMarketSignal,
        preMarketGapPercent: Number(preMarketGapPercent.toFixed(2)),
        currentPrice: quote.regularMarketPrice ?? null,
        changePercent: quote.regularMarketChangePercent ?? 0,
        open: quote.regularMarketOpen ?? null,
        previousClose,
        volume: quote.regularMarketVolume ?? 0,
        averageVolume: quote.averageVolume ?? quote.averageDailyVolume10Day ?? 0,
        marketCap: quote.marketCap ?? 0,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
        timestamp: new Date().toISOString()
      };
    });
  }

  async getDeepMarketAnalysis(tickers = []) {
    const snapshots = await this.getPreMarketSnapshot(tickers);
    const analysisItems = [];

    for (const item of snapshots) {
      const {
        ticker, currentPrice, changePercent,
        preMarketGapPercent, preMarketSignal,
        averageVolume, volume, fiftyTwoWeekHigh, fiftyTwoWeekLow
      } = item;

      let rsi = 50;
      let streaks = { currentGainStreak: 0, currentLossStreak: 0 };

      try {
        rsi = await this.analyticsService.calculateRSI(ticker);
        streaks = await this.analyticsService.calculateConsecutiveStreaks(ticker);
      } catch (err) {
        console.error(`Deep analysis error for ${ticker}:`, err.message);
      }

      const reasons = [];
      if (preMarketSignal === 'UP') {
        reasons.push(`Pre-market is up ${(item.preMarketChangePercent || 0).toFixed(2)}%, indicating early strength for the session.`);
      } else if (preMarketSignal === 'DOWN') {
        reasons.push(`Pre-market is down ${Math.abs(item.preMarketChangePercent || 0).toFixed(2)}%, signaling early weakness.`);
      }
      if (rsi <= 35) {
        reasons.push('RSI is low, suggesting the stock may be oversold and worth watching for a rebound.');
      }
      if (rsi >= 75) {
        reasons.push('RSI is high, signaling potential overbought conditions and caution on new entries.');
      }
      if (streaks.currentGainStreak >= 2) {
        reasons.push(`The stock is on a ${streaks.currentGainStreak}-day gain streak.`);
      }
      if (streaks.currentLossStreak >= 2) {
        reasons.push(`The stock is on a ${streaks.currentLossStreak}-day loss streak.`);
      }
      if (changePercent >= 2) {
        reasons.push('Market momentum is positive, with a strong intraday move.');
      }
      if (changePercent <= -2) {
        reasons.push('Market momentum is negative, with a sharp intraday decline.');
      }
      if (currentPrice && fiftyTwoWeekLow && currentPrice <= fiftyTwoWeekLow * 1.05) {
        reasons.push('Price is trading near the 52-week low, which may signal support or structural risk.');
      }
      if (currentPrice && fiftyTwoWeekHigh && currentPrice >= fiftyTwoWeekHigh * 0.95) {
        reasons.push('Price is trading near the 52-week high, which may attract profit-taking.');
      }

      const isAvoid = (
        preMarketGapPercent <= -2 ||
        changePercent <= -4 ||
        streaks.currentLossStreak >= 3 ||
        rsi >= 75
      );

      const isCheck = !isAvoid && (
        preMarketGapPercent >= 1 ||
        changePercent >= 2 ||
        streaks.currentGainStreak >= 2 ||
        rsi <= 35
      );

      const recommendation = isAvoid ? 'AVOID' : isCheck ? 'CHECK' : 'WATCH';
      const riskLevel = isAvoid ? 'HIGH' : isCheck ? 'MEDIUM' : 'LOW';

      analysisItems.push({
        ...item,
        rsi: Number((rsi || 50).toFixed(2)),
        streaks,
        recommendation,
        riskLevel,
        reasons,
        targetPrice: currentPrice ? Number((currentPrice * 1.06).toFixed(2)) : null,
        stopLoss: currentPrice ? Number((currentPrice * 0.95).toFixed(2)) : null
      });
    }

    return {
      deepMarket: analysisItems.sort((a, b) => b.changePercent - a.changePercent),
      avoidList: analysisItems.filter(item => item.recommendation === 'AVOID'),
      checkList: analysisItems.filter(item => item.recommendation === 'CHECK')
    };
  }
}

module.exports = MarketService;
