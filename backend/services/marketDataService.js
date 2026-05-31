// backend/services/marketDataService.js
// Resilient multi-provider market data service for NSE/BSE stocks
// Provider Hierarchy: Yahoo Finance → Finnhub → Cache Fallback

const { getYahooFinance } = require('../utils/yahooClient');
const axios = require('axios');
const pino = require('pino');

const logger = pino();

class MarketDataService {
  constructor() {
    this.priceCache = new Map();
    this.cacheExpiry = 60 * 1000; // 60 seconds
    this.circuitBreakers = new Map();
    this.maxRetries = 2;
    this.retryDelay = 500;
  }

  /**
   * Get latest price for a ticker using fallback logic
   * Provider Order: Yahoo Finance → Finnhub → Cache
   */
  async getLatestPrice(ticker) {
    try {
      // Try Provider A: Yahoo Finance (primary)
      try {
        const price = await this._fetchFromYahooFinance(ticker);
        if (price) {
          this._updateCache(ticker, price);
          return price;
        }
      } catch (err) {
        logger.warn({ ticker, provider: 'Yahoo', error: err.message }, 'Provider A failed');
        this._recordProviderFailure('yahoo', ticker);
      }

      // Try Provider B: Finnhub (fallback 1)
      try {
        const price = await this._fetchFromFinnhub(ticker);
        if (price) {
          this._updateCache(ticker, price);
          return price;
        }
      } catch (err) {
        logger.warn({ ticker, provider: 'Finnhub', error: err.message }, 'Provider B failed');
        this._recordProviderFailure('finnhub', ticker);
      }

      // Fallback C: Return cached price if available
      const cached = this._getCachedPrice(ticker);
      if (cached) {
        logger.info({ ticker }, 'Using cached price (all providers failed)');
        return { ...cached, source: 'CACHE' };
      }

      // No data available
      logger.error({ ticker }, 'All providers exhausted');
      return null;
    } catch (error) {
      logger.error({ ticker, error: error.message }, 'Unexpected error in getLatestPrice');
      return this._getCachedPrice(ticker);
    }
  }

  /**
   * Batch fetch prices for multiple tickers (optimized for 1K concurrent users)
   */
  async getPricesBatch(tickers) {
    const promises = tickers.map((ticker) =>
      this.getLatestPrice(ticker).catch((err) => {
        logger.error({ ticker, error: err.message }, 'Batch fetch error');
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter((r) => r !== null);
  }

  /**
   * Provider A: Yahoo Finance
   */
  async _fetchFromYahooFinance(ticker) {
    // Check circuit breaker
    if (this._isCircuitOpen('yahoo')) {
      throw new Error('Yahoo Finance circuit breaker open');
    }

    try {
      const yahooFinance = await getYahooFinance();
      const quote = await yahooFinance.quote(ticker);

      if (!quote || !quote.regularMarketPrice) {
        throw new Error('Invalid quote response');
      }

      this._recordProviderSuccess('yahoo');

      return {
        ticker,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        open: quote.regularMarketOpen || 0,
        exchange: 'NSE', // Yahoo returns NSE by default for .NS tickers
        source: 'YAHOO',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Provider B: Finnhub (free tier)
   */
  async _fetchFromFinnhub(ticker) {
    // Check circuit breaker
    if (this._isCircuitOpen('finnhub')) {
      throw new Error('Finnhub circuit breaker open');
    }

    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('Finnhub API key not configured');
    }

    try {
      // Finnhub expects ticker format without exchange suffix
      const cleanTicker = ticker.replace('.NS', '').replace('.BO', '');
      
      const response = await axios.get('https://finnhub.io/api/v1/quote', {
        params: {
          symbol: cleanTicker,
          token: apiKey,
        },
        timeout: 5000,
      });

      const data = response.data;
      if (!data || !data.c) {
        throw new Error('Invalid Finnhub response');
      }

      this._recordProviderSuccess('finnhub');

      return {
        ticker,
        price: data.c,
        change: data.d || 0,
        changePercent: data.dp || 0,
        volume: 0, // Finnhub free tier doesn't include volume
        high: data.h || 0,
        low: data.l || 0,
        open: data.o || 0,
        exchange: 'NSE',
        source: 'FINNHUB',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cache Management
   */
  _updateCache(ticker, priceData) {
    this.priceCache.set(ticker, {
      ...priceData,
      cachedAt: Date.now(),
    });
  }

  _getCachedPrice(ticker) {
    const cached = this.priceCache.get(ticker);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.cachedAt > this.cacheExpiry) {
      this.priceCache.delete(ticker);
      return null;
    }

    return cached;
  }

  /**
   * Circuit Breaker Pattern (prevent hammering failed providers)
   */
  _recordProviderFailure(provider, ticker) {
    const key = `${provider}:${ticker}`;
    const record = this.circuitBreakers.get(key) || { failures: 0, lastFailedAt: null };
    record.failures++;
    record.lastFailedAt = Date.now();
    this.circuitBreakers.set(key, record);

    if (record.failures >= 3) {
      logger.warn({ provider, ticker }, 'Circuit breaker will open in 60s');
    }
  }

  _recordProviderSuccess(provider) {
    // Clear all circuit breakers for this provider on success
    for (const [key, record] of this.circuitBreakers.entries()) {
      if (key.startsWith(`${provider}:`)) {
        record.failures = 0;
      }
    }
  }

  _isCircuitOpen(provider) {
    // Check if provider has too many failures (circuit open for 60s)
    for (const [key, record] of this.circuitBreakers.entries()) {
      if (key.startsWith(`${provider}:`)) {
        if (record.failures >= 3) {
          const timeSinceFailure = Date.now() - record.lastFailedAt;
          if (timeSinceFailure < 60 * 1000) {
            return true; // Circuit is open
          }
        }
      }
    }
    return false;
  }

  /**
   * Get list of all NSE/BSE tickers (for recommendations, watchlist)
   */
  async getAvailableTickers() {
    // Return cached list of popular NSE stocks (these are the reliable ones)
    return require('../utils/niftySymbols').getNifty50Symbols();
  }

  /**
   * Cache pre-warming (call on server startup)
   */
  async warmupCache() {
    logger.info('Starting cache warm-up...');
    const tickers = await this.getAvailableTickers();
    const topTickers = tickers.slice(0, 10); // Warm up top 10

    await Promise.all(
      topTickers.map((ticker) =>
        this.getLatestPrice(ticker).catch((err) =>
          logger.warn({ ticker, error: err.message }, 'Warmup failed for ticker')
        )
      )
    );

    logger.info('Cache warm-up complete');
  }
}

module.exports = new MarketDataService();
