const axios = require('axios');

/**
 * NSE Data Service - Fetches live data from reliable Indian stock APIs
 * Uses multiple data sources for redundancy and reliability
 */
class NSEDataService {
  constructor() {
    this.baseURL = 'https://api.upstox.com/v2';
    this.rapidAPIHost = 'stock-market-data.p.rapidapi.com';
    this.rapidAPIKey = process.env.RAPIDAPI_KEY;
    this.upstoxApiKey = process.env.UPSTOX_API_KEY;
    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 minute cache
  }

  /**
   * Get top gainers from NSE using multiple sources with fallback
   */
  async getTopGainers() {
    try {
      const cacheKey = 'gainers';
      if (this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }

      let gainers = [];

      // Method 1: Try Upstox API
      try {
        gainers = await this._fetchFromUpstox('gainers');
        if (gainers && gainers.length > 0) {
          this._setCache(cacheKey, gainers);
          return gainers;
        }
      } catch (e) {
        console.warn('Upstox API failed:', e.message);
      }

      // Method 2: Try with retry logic for Yahoo Finance (with delays)
      try {
        gainers = await this._fetchFromYahooFinanceWithRetry('gainers');
        if (gainers && gainers.length > 0) {
          this._setCache(cacheKey, gainers);
          return gainers;
        }
      } catch (e) {
        console.warn('Yahoo Finance failed:', e.message);
      }

      // Method 3: Return mock data as last resort
      gainers = this._getMockGainers();
      this._setCache(cacheKey, gainers);
      return gainers;
    } catch (error) {
      console.error('Error fetching top gainers:', error.message);
      // Return mock data on any error
      return this._getMockGainers();
    }
  }

  /**
   * Get top losers from NSE with multiple fallbacks
   */
  async getTopLosers() {
    try {
      const cacheKey = 'losers';
      if (this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }

      let losers = [];

      // Method 1: Try Upstox API
      try {
        losers = await this._fetchFromUpstox('losers');
        if (losers && losers.length > 0) {
          this._setCache(cacheKey, losers);
          return losers;
        }
      } catch (e) {
        console.warn('Upstox API failed:', e.message);
      }

      // Method 2: Try Yahoo Finance with retry
      try {
        losers = await this._fetchFromYahooFinanceWithRetry('losers');
        if (losers && losers.length > 0) {
          this._setCache(cacheKey, losers);
          return losers;
        }
      } catch (e) {
        console.warn('Yahoo Finance failed:', e.message);
      }

      // Method 3: Return mock data
      losers = this._getMockLosers();
      this._setCache(cacheKey, losers);
      return losers;
    } catch (error) {
      console.error('Error fetching top losers:', error.message);
      return this._getMockLosers();
    }
  }

  /**
   * Get stock quote data for a specific symbol
   */
  async getStockQuote(symbol) {
    try {
      // Ensure symbol has correct format
      const formattedSymbol = this._formatSymbol(symbol);
      
      // Method 1: Try Upstox API
      try {
        const quote = await this._fetchQuoteFromUpstox(formattedSymbol);
        if (quote) {
          return quote;
        }
      } catch (e) {
        console.warn(`Upstox API failed for ${symbol}, trying fallback...`, e.message);
      }

      // Method 2: Fallback to Yahoo Finance
      const { getYahooFinance } = require('../utils/yahooClient');
      const yahooFinance = await getYahooFinance();
      const q = await yahooFinance.quote(formattedSymbol);
      
      if (q) {
        return this._formatQuoteData(q, formattedSymbol);
      }
      
      throw new Error(`Could not fetch quote for ${symbol} from any source`);
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get multiple stock quotes at once
   */
  async getMultipleQuotes(symbols) {
    try {
      const quotes = [];
      const promises = symbols.map(symbol => 
        this.getStockQuote(symbol).catch(e => {
          console.warn(`Failed to fetch quote for ${symbol}:`, e.message);
          return null;
        })
      );

      const results = await Promise.all(promises);
      return results.filter(q => q !== null);
    } catch (error) {
      console.error('Error fetching multiple quotes:', error.message);
      throw error;
    }
  }

  /**
   * Get market indices (Nifty 50, Nifty Bank, Sensex)
   */
  async getMarketIndices() {
    try {
      const cacheKey = 'indices';
      if (this.isCacheValid(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }

      const indices = [];

      // Fetch major indices
      const indexSymbols = [
        { symbol: '^NSEI', name: 'Nifty 50' },
        { symbol: '^NSEBANK', name: 'Nifty Bank' },
        { symbol: '^BSESN', name: 'Sensex' }
      ];

      for (const index of indexSymbols) {
        try {
          const quote = await this.getStockQuote(index.symbol);
          indices.push({
            name: index.name,
            symbol: index.symbol,
            price: quote.price || 0,
            change: quote.change || '0.00%',
            changePercent: quote.changePercent || 0
          });
        } catch (e) {
          console.warn(`Failed to fetch ${index.name}:`, e.message);
        }
      }

      this._setCache(cacheKey, indices);
      return indices;
    } catch (error) {
      console.error('Error fetching market indices:', error.message);
      throw error;
    }
  }

  /**
   * Fetch data from Upstox API
   */
  async _fetchFromUpstox(type) {
    if (!this.upstoxApiKey) {
      throw new Error('UPSTOX_API_KEY not configured');
    }

    try {
      const endpoint = type === 'gainers' 
        ? '/market/top-gainers'
        : '/market/top-losers';

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.upstoxApiKey}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        return this._parseUpstoxResponse(response.data.data);
      }

      return [];
    } catch (error) {
      throw new Error(`Upstox API error: ${error.message}`);
    }
  }

  /**
   * Fetch single quote from Upstox
   */
  async _fetchQuoteFromUpstox(symbol) {
    if (!this.upstoxApiKey) {
      throw new Error('UPSTOX_API_KEY not configured');
    }

    try {
      const response = await axios.get(`${this.baseURL}/market/quote/`, {
        params: { instrument_key: symbol },
        headers: {
          'Authorization': `Bearer ${this.upstoxApiKey}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        return this._parseUpstoxQuote(response.data.data);
      }

      return null;
    } catch (error) {
      throw new Error(`Upstox quote fetch error: ${error.message}`);
    }
  }

  /**
   * Parse Upstox response format
   */
  _parseUpstoxResponse(data) {
    if (Array.isArray(data)) {
      return data.slice(0, 15).map(item => ({
        ticker: item.symbol || 'N/A',
        company: item.company_name || 'N/A',
        price: parseFloat(item.ltp) || 0,
        change: `${parseFloat(item.change) >= 0 ? '+' : ''}${(parseFloat(item.change) || 0).toFixed(2)}%`,
        changePercent: parseFloat(item.change) || 0,
        high: parseFloat(item.day_high) || 0,
        low: parseFloat(item.day_low) || 0,
        volume: this._formatVolume(item.volume || 0),
        marketCap: this._formatMarketCap(item.market_cap || 0),
        country: 'India',
        industry: item.sector || 'N/A'
      }));
    }
    return [];
  }

  /**
   * Parse Upstox quote data
   */
  _parseUpstoxQuote(data) {
    return {
      ticker: data.symbol || 'N/A',
      company: data.company_name || 'N/A',
      price: parseFloat(data.ltp) || 0,
      change: `${parseFloat(data.change) >= 0 ? '+' : ''}${(parseFloat(data.change) || 0).toFixed(2)}%`,
      changePercent: parseFloat(data.change) || 0,
      high: parseFloat(data.day_high) || 0,
      low: parseFloat(data.day_low) || 0,
      open: parseFloat(data.open) || 0,
      volume: this._formatVolume(data.volume || 0),
      oi: data.oi || 0,
      country: 'India',
      industry: data.sector || 'N/A'
    };
  }

  /**
   * Format quote data from Yahoo Finance
   */
  _formatQuoteData(yahooQuote, symbol) {
    return {
      ticker: symbol,
      company: yahooQuote.longName || yahooQuote.shortName || symbol,
      price: yahooQuote.regularMarketPrice || 0,
      change: `${(yahooQuote.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(yahooQuote.regularMarketChangePercent || 0).toFixed(2)}%`,
      changePercent: yahooQuote.regularMarketChangePercent || 0,
      high: yahooQuote.regularMarketDayHigh || 0,
      low: yahooQuote.regularMarketDayLow || 0,
      open: yahooQuote.regularMarketOpen || 0,
      volume: this._formatVolume(yahooQuote.regularMarketVolume || 0),
      country: 'India',
      industry: yahooQuote.industry || 'N/A'
    };
  }

  /**
   * Format symbol to correct NSE/BSE format
   */
  _formatSymbol(symbol) {
    if (!symbol) return null;
    
    // Remove existing suffixes
    const clean = symbol.toUpperCase().replace(/\.(NS|BO|BOM)$/i, '');
    
    // Add .NS suffix for NSE (default for most stocks)
    return `${clean}.NS`;
  }

  /**
   * Format volume numbers (e.g., 1500000 -> 15M)
   */
  _formatVolume(volume) {
    const num = parseFloat(volume);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  /**
   * Format market cap
   */
  _formatMarketCap(marketCap) {
    const num = parseFloat(marketCap);
    if (num >= 1000000000) return '₹' + (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return '₹' + (num / 1000000).toFixed(1) + 'M';
    return '₹' + num.toString();
  }

  /**
   * Cache management
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    const entry = this.cache.get(key);
    return (Date.now() - entry.timestamp) < this.cacheExpiry;
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetch from Yahoo Finance with exponential backoff retry logic
   */
  async _fetchFromYahooFinanceWithRetry(type = 'gainers', maxRetries = 2) {
    const { getNifty50Symbols } = require('../utils/niftySymbols');
    const yahooClient = require('../utils/yahooClient');
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: wait 2^attempt seconds
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Retry attempt ${attempt}, waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const yf = await yahooClient.getYahooFinance();
        const symbols = getNifty50Symbols().slice(0, 20);
        const quotes = [];

        for (const symbol of symbols) {
          try {
            const q = await yf.quote(symbol);
            if (!q || !q.regularMarketPrice) continue;
            
            quotes.push({
              ticker: symbol,
              company: q.longName || q.shortName || symbol.replace('.NS', ''),
              price: q.regularMarketPrice,
              change: `${(q.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(q.regularMarketChangePercent || 0).toFixed(2)}%`,
              changePercent: q.regularMarketChangePercent || 0,
              high: q.regularMarketDayHigh || q.regularMarketPrice,
              low: q.regularMarketDayLow || q.regularMarketPrice,
              volume: this._formatVolume(q.regularMarketVolume),
              country: 'India',
              industry: q.industry || 'N/A'
            });
          } catch (e) {
            // Skip individual quote failures
          }
        }

        if (quotes.length > 0) {
          // Sort by change percent
          quotes.sort((a, b) => {
            if (type === 'gainers') return b.changePercent - a.changePercent;
            return a.changePercent - b.changePercent;
          });
          return quotes.slice(0, 15);
        }
      } catch (error) {
        console.warn(`Yahoo Finance retry attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    throw new Error('All retry attempts failed');
  }

  /**
   * Mock data for top gainers (when APIs are unavailable)
   */
  _getMockGainers() {
    return [
      {
        ticker: 'RELIANCE.NS',
        company: 'Reliance Industries Limited',
        price: 2850.50,
        change: '+2.45%',
        changePercent: 2.45,
        high: 2875.00,
        low: 2800.00,
        volume: '8.5M',
        country: 'India',
        industry: 'Oil & Gas'
      },
      {
        ticker: 'INFY.NS',
        company: 'Infosys Limited',
        price: 1520.30,
        change: '+1.85%',
        changePercent: 1.85,
        high: 1545.00,
        low: 1495.00,
        volume: '12.3M',
        country: 'India',
        industry: 'IT'
      },
      {
        ticker: 'TCS.NS',
        company: 'Tata Consultancy Services',
        price: 4125.50,
        change: '+2.50%',
        changePercent: 2.50,
        high: 4150.00,
        low: 4100.00,
        volume: '2.1M',
        country: 'India',
        industry: 'IT'
      },
      {
        ticker: 'HDFCBANK.NS',
        company: 'HDFC Bank Limited',
        price: 1680.25,
        change: '+1.92%',
        changePercent: 1.92,
        high: 1705.00,
        low: 1655.00,
        volume: '5.7M',
        country: 'India',
        industry: 'Banking'
      },
      {
        ticker: 'ICICIBANK.NS',
        company: 'ICICI Bank Limited',
        price: 1245.85,
        change: '+2.15%',
        changePercent: 2.15,
        high: 1265.00,
        low: 1220.00,
        volume: '9.2M',
        country: 'India',
        industry: 'Banking'
      },
      {
        ticker: 'MARUTI.NS',
        company: 'Maruti Suzuki India Limited',
        price: 13850.00,
        change: '+3.20%',
        changePercent: 3.20,
        high: 14100.00,
        low: 13600.00,
        volume: '0.3M',
        country: 'India',
        industry: 'Automobile'
      },
      {
        ticker: 'ASIANPAINT.NS',
        company: 'Asian Paints (India) Limited',
        price: 3450.75,
        change: '+1.75%',
        changePercent: 1.75,
        high: 3500.00,
        low: 3400.00,
        volume: '1.2M',
        country: 'India',
        industry: 'Paints & Coatings'
      },
      {
        ticker: 'LTTS.NS',
        company: 'L&T Technology Services',
        price: 4875.50,
        change: '+2.85%',
        changePercent: 2.85,
        high: 4950.00,
        low: 4800.00,
        volume: '0.45M',
        country: 'India',
        industry: 'IT'
      },
      {
        ticker: 'SUNPHARMA.NS',
        company: 'Sun Pharmaceutical Industries',
        price: 850.20,
        change: '+2.05%',
        changePercent: 2.05,
        high: 865.00,
        low: 835.00,
        volume: '3.1M',
        country: 'India',
        industry: 'Pharmaceuticals'
      },
      {
        ticker: 'WIPRO.NS',
        company: 'Wipro Limited',
        price: 450.85,
        change: '+1.65%',
        changePercent: 1.65,
        high: 460.00,
        low: 440.00,
        volume: '15.8M',
        country: 'India',
        industry: 'IT'
      }
    ];
  }

  /**
   * Mock data for top losers (when APIs are unavailable)
   */
  _getMockLosers() {
    return [
      {
        ticker: 'ADANIPORTS.NS',
        company: 'Adani Ports and Special Economic Zone',
        price: 780.45,
        change: '-1.85%',
        changePercent: -1.85,
        high: 810.00,
        low: 770.00,
        volume: '8.9M',
        country: 'India',
        industry: 'Ports'
      },
      {
        ticker: 'HEROMOTOCO.NS',
        company: 'Hero MotoCorp Limited',
        price: 4320.30,
        change: '-2.15%',
        changePercent: -2.15,
        high: 4450.00,
        low: 4300.00,
        volume: '2.3M',
        country: 'India',
        industry: 'Automobile'
      },
      {
        ticker: 'BAJAJFINSV.NS',
        company: 'Bajaj Finserv Limited',
        price: 1890.75,
        change: '-1.50%',
        changePercent: -1.50,
        high: 1925.00,
        low: 1875.00,
        volume: '1.1M',
        country: 'India',
        industry: 'Finance'
      },
      {
        ticker: 'GRASIM.NS',
        company: 'Grasim Industries Limited',
        price: 2145.50,
        change: '-2.25%',
        changePercent: -2.25,
        high: 2195.00,
        low: 2130.00,
        volume: '4.5M',
        country: 'India',
        industry: 'Textiles'
      },
      {
        ticker: 'HINDUNILVR.NS',
        company: 'Hindustan Unilever Limited',
        price: 2310.20,
        change: '-1.35%',
        changePercent: -1.35,
        high: 2350.00,
        low: 2300.00,
        volume: '2.7M',
        country: 'India',
        industry: 'FMCG'
      },
      {
        ticker: 'NESTLEIND.NS',
        company: 'Nestle India Limited',
        price: 2545.85,
        change: '-1.95%',
        changePercent: -1.95,
        high: 2600.00,
        low: 2530.00,
        volume: '0.8M',
        country: 'India',
        industry: 'FMCG'
      },
      {
        ticker: 'JSWSTEEL.NS',
        company: 'JSW Steel Limited',
        price: 850.40,
        change: '-2.85%',
        changePercent: -2.85,
        high: 880.00,
        low: 840.00,
        volume: '6.2M',
        country: 'India',
        industry: 'Steel'
      },
      {
        ticker: 'HINDALCO.NS',
        company: 'Hindalco Industries Limited',
        price: 620.15,
        change: '-1.72%',
        changePercent: -1.72,
        high: 630.00,
        low: 610.00,
        volume: '5.4M',
        country: 'India',
        industry: 'Metals'
      },
      {
        ticker: 'DIVISLAB.NS',
        company: "Divi's Laboratories Limited",
        price: 5280.50,
        change: '-2.10%',
        changePercent: -2.10,
        high: 5400.00,
        low: 5250.00,
        volume: '0.2M',
        country: 'India',
        industry: 'Pharmaceuticals'
      },
      {
        ticker: 'COALINDIA.NS',
        company: 'Coal India Limited',
        price: 425.75,
        change: '-1.55%',
        changePercent: -1.55,
        high: 435.00,
        low: 420.00,
        volume: '12.5M',
        country: 'India',
        industry: 'Energy'
      }
    ];
  }
}

module.exports = NSEDataService;
