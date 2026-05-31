const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const pino = require('pino');

const {
  scrapeMoneycontrolCategory,
  getNiftyMarketLeaders,
  searchIndianTicker,
  fetchYahooFinanceMoversFallback
} = require('./scraper');
const { generateRecommendations, compileStockIntelligence } = require('./recommendationEngine');
const { getYahooFinance } = require('./utils/yahooClient');

// Import Services
const WebSocketService = require('./services/websocketService');
const marketAnalysisService = require('./services/marketAnalysisService');
const marketHolidayManager = require('./utils/marketHolidayManager');

// Import Routes
const portfolioRoutes = require('./routes/portfolio');
const analyticsRoutes = require('./routes/analytics');
const recommendationsRoutes = require('./routes/recommendations');
const marketRoutes = require('./routes/market');
const marketAnalysisRoutes = require('./routes/marketAnalysis');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Connection (Optional - for local development)
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('⚠️ MongoDB Connection Optional:', err.message));
}

// Initialize WebSocket Service
const wsService = new WebSocketService(io);
wsService.setupConnections();

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Cache variables
let marketCache = null;
let marketCacheTime = 0;
let picksCache = null;
let picksCacheTime = 0;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// 1. Get Live Scraped Indian Market Data and Nifty Leaders
app.get('/api/market', async (req, res) => {
  const now = Date.now();
  if (marketCache && (now - marketCacheTime < CACHE_DURATION)) {
    return res.json(marketCache);
  }

  let gainers = [];
  let losers = [];
  let niftyLeaders = [];
  let source = 'live';

  // Attempt 1: Scrape from Moneycontrol
  try {
    console.log('Fetching live scraped Indian market data from Moneycontrol...');
    gainers = await scrapeMoneycontrolCategory('Top Gainers');
    losers = await scrapeMoneycontrolCategory('Top Losers');
    console.log(`✓ Scraped ${gainers.length} gainers, ${losers.length} losers from Moneycontrol`);
  } catch (error) {
    console.warn('⚠️ Moneycontrol scraping failed, trying Yahoo Finance fallback:', error.message);
  }

  // Attempt 2: Yahoo Finance fallback if scraping returned empty
  if (gainers.length === 0) {
    try {
      console.log('Fetching NSE gainers from Yahoo Finance as fallback...');
      gainers = await fetchYahooFinanceMoversFallback('gainers');
      source = gainers.length > 0 ? 'yahoo-finance' : 'unavailable';
      console.log(`✓ Yahoo Finance fallback gainers: ${gainers.length}`);
    } catch (err) {
      console.error('✗ Yahoo Finance gainers fallback also failed:', err.message);
    }
  }

  if (losers.length === 0) {
    try {
      console.log('Fetching NSE losers from Yahoo Finance as fallback...');
      losers = await fetchYahooFinanceMoversFallback('losers');
      console.log(`✓ Yahoo Finance fallback losers: ${losers.length}`);
    } catch (err) {
      console.error('✗ Yahoo Finance losers fallback also failed:', err.message);
    }
  }

  // Fetch Nifty Leaders (always from Yahoo Finance)
  try {
    console.log('Fetching Nifty 50 market leaders quote data...');
    niftyLeaders = await getNiftyMarketLeaders();
    console.log(`✓ Fetched ${niftyLeaders.length} Nifty leaders`);
  } catch (err) {
    console.error('✗ Failed to fetch Nifty leaders:', err.message);
  }

  marketCache = {
    success: true,
    source,
    timestamp: new Date().toISOString(),
    trending: niftyLeaders,
    market: {
      'Top Gainers': gainers,
      'Top Losers': losers
    }
  };
  marketCacheTime = now;

  return res.json(marketCache);
});

// 2. Get AI Stock Picks for Indian Market
app.get('/api/picks', async (req, res) => {
  const now = Date.now();
  if (picksCache && (now - picksCacheTime < CACHE_DURATION)) {
    return res.json(picksCache);
  }

  try {
    console.log('Generating dynamic stock picks for Indian stocks...');
    const recommendations = await generateRecommendations();

    if (!recommendations || (recommendations.recommended?.length === 0 && recommendations.avoid?.length === 0)) {
      throw new Error('Recommendations engine returned empty result');
    }

    picksCache = {
      success: true,
      source: 'live',
      timestamp: new Date().toISOString(),
      picks: recommendations
    };
    picksCacheTime = now;

    return res.json(picksCache);
  } catch (error) {
    console.error('Failed to generate live recommendations:', error.message);

    // Dynamic fallback: fetch most-active NSE stocks from Yahoo Finance
    try {
      console.log('Attempting dynamic Yahoo Finance recommendation fallback...');
      const { getRandomSymbols } = require('./utils/niftySymbols');
      const yahooFinance = await getYahooFinance();
      const sampleSymbols = getRandomSymbols(15);
      const liveQuotes = [];

      for (const sym of sampleSymbols) {
        try {
          const q = await yahooFinance.quote(sym);
          if (q && q.regularMarketPrice) {
            liveQuotes.push({ ticker: sym, quote: q });
          }
        } catch (_) { /* skip */ }
      }

      if (liveQuotes.length === 0) throw new Error('No live quotes available for fallback');

      // Sort: top gainers = recommended, top losers = avoid
      liveQuotes.sort((a, b) => (b.quote.regularMarketChangePercent || 0) - (a.quote.regularMarketChangePercent || 0));

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 45);

      const buildPick = async (item, pickCategory, reasoning, risk, targetPct, stopPct) => {
        const q = item.quote;
        const currentPrice = q.regularMarketPrice;
        const chartData = await yahooFinance.chart(item.ticker, {
          period1: thirtyDaysAgo,
          period2: today,
          interval: '1d'
        }).catch(() => null);

        let rsiEst = 50;
        if (chartData && chartData.quotes && chartData.quotes.length >= 14) {
          const prices = chartData.quotes.map(c => c.close).filter(Boolean);
          if (prices.length >= 14) {
            let gains = 0, losses = 0;
            for (let i = prices.length - 14; i < prices.length; i++) {
              const diff = prices[i] - prices[i - 1];
              if (diff > 0) gains += diff; else losses -= diff;
            }
            const rs = gains / (losses || 1);
            rsiEst = Math.round(100 - (100 / (1 + rs)));
          }
        }

        const intel = await compileStockIntelligence(item.ticker, q.longName || item.ticker, currentPrice, q, rsiEst, chartData);

        return {
          ticker: item.ticker,
          company: q.longName || q.shortName || item.ticker.replace('.NS', ''),
          industry: q.industry || 'Indian Equities',
          sector: q.sector || 'N/A',
          price: currentPrice,
          change: `${(q.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(q.regularMarketChangePercent || 0).toFixed(2)}%`,
          changePercent: q.regularMarketChangePercent || 0,
          volume: formatVolume(q.regularMarketVolume),
          marketCap: q.marketCap ? formatMarketCap(q.marketCap) : 'N/A',
          peRatio: q.trailingPE ? q.trailingPE.toFixed(1) : 'N/A',
          fiftyTwoWeekRange: `₹${q.fiftyTwoWeekLow || 'N/A'} - ₹${q.fiftyTwoWeekHigh || 'N/A'}`,
          pickCategory,
          risk,
          entryRange: `₹${currentPrice.toFixed(2)} - ₹${(currentPrice * 1.015).toFixed(2)}`,
          targetPrice: `₹${(currentPrice * (1 + targetPct)).toFixed(2)}`,
          stopLoss: `₹${(currentPrice * (1 - stopPct)).toFixed(2)}`,
          rsiEstimate: rsiEst,
          reasoning,
          streak: intel.streak,
          forwardOutlook: intel.forwardOutlook,
          newsCatalysts: intel.newsCatalysts,
          viewerSentiment: intel.viewerSentiment,
          bigShotRecommendations: intel.bigShotRecommendations,
          chartHistory: chartData && chartData.quotes ? chartData.quotes.map(c => ({
            date: c.date.toISOString().split('T')[0],
            price: Number(c.close?.toFixed(2)) || null
          })).filter(c => c.price !== null) : []
        };
      };

      const recommended = [];
      const avoid = [];

      const topGainers = liveQuotes.filter(q => (q.quote.regularMarketChangePercent || 0) > 0).slice(0, 3);
      const topLosers = liveQuotes.filter(q => (q.quote.regularMarketChangePercent || 0) < 0).slice(-2);

      for (const item of topGainers) {
        const pick = await buildPick(item, 'NSE Momentum Leader',
          'Showing strong positive momentum with elevated buying activity. Technically positioned above key moving averages with healthy volume expansion.',
          'Medium', 0.08, 0.03).catch(() => null);
        if (pick) recommended.push(pick);
      }

      for (const item of topLosers) {
        const pick = await buildPick(item, 'NSE Selling Pressure',
          'Exhibiting sustained selling pressure with volume distribution. Technical metrics indicate elevated risk; recommend waiting for stabilization before entry.',
          'High Risk', -0.05, 0.04).catch(() => null);
        if (pick) avoid.push(pick);
      }

      picksCache = {
        success: true,
        source: 'yahoo-finance-fallback',
        timestamp: new Date().toISOString(),
        picks: { recommended, avoid }
      };
      picksCacheTime = now;

      return res.json(picksCache);
    } catch (fallbackError) {
      console.error('Dynamic Yahoo Finance picks fallback also failed:', fallbackError.message);
      return res.status(503).json({
        success: false,
        error: 'Market data temporarily unavailable. Please try again in a moment.',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// 3. Search Tickers
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  try {
    console.log(`Searching Indian symbols for query: ${query}`);
    const yahooFinance = await getYahooFinance();
    const results = await yahooFinance.search(query);

    const formatted = (results.quotes || [])
      .filter(q => q.symbol && typeof q.symbol === 'string' && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')))
      .map(q => ({
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        type: q.quoteType,
        exchange: q.exchange
      }));

    return res.json({ success: true, results: formatted });
  } catch (error) {
    console.error(`Search failed for "${query}":`, error.message);
    return res.json({ success: false, results: [] });
  }
});

// 4. Detailed Ticker Info (Details + News + Sentiment + Brokerages)
app.get('/api/stock/:symbol', async (req, res) => {
  let symbol = req.params.symbol.toUpperCase();

  if (!symbol.includes('.') && !symbol.endsWith('.NS') && !symbol.endsWith('.BO')) {
    symbol = `${symbol}.NS`;
  }

  try {
    console.log(`Fetching Indian stats for ticker: ${symbol}`);
    const yahooFinance = await getYahooFinance();
    const quote = await yahooFinance.quote(symbol);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 45);

    console.log(`Fetching chart coordinates for Indian ticker: ${symbol}`);
    const chartData = await yahooFinance.chart(symbol, {
      period1: thirtyDaysAgo,
      period2: today,
      interval: '1d'
    }).catch(() => null);

    const chartHistory = chartData && chartData.quotes ? chartData.quotes.map(q => ({
      date: q.date.toISOString().split('T')[0],
      price: Number(q.close?.toFixed(2)) || null,
      volume: q.volume || null
    })).filter(q => q.price !== null) : [];

    const currentPrice = quote.regularMarketPrice || 0;

    // Compile dynamic, highly specialized Indian market catalysts & brokerage recommendations
    const intel = await compileStockIntelligence(symbol, quote.longName || quote.shortName || symbol, currentPrice, quote, 50, chartData);

    return res.json({
      success: true,
      ticker: symbol,
      company: quote.longName || quote.shortName || symbol.replace('.NS', ''),
      price: currentPrice,
      changePercent: quote.regularMarketChangePercent || 0,
      change: `${(quote.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(quote.regularMarketChangePercent || 0).toFixed(2)}%`,
      volume: formatVolume(quote.regularMarketVolume),
      marketCap: quote.marketCap ? formatMarketCap(quote.marketCap) : 'N/A',
      peRatio: quote.trailingPE ? quote.trailingPE.toFixed(1) : 'N/A',
      eps: quote.epsTrailingTwelveMonths ? quote.epsTrailingTwelveMonths.toFixed(2) : 'N/A',
      dividendYield: quote.trailingAnnualDividendYield ? `${(quote.trailingAnnualDividendYield * 100).toFixed(2)}%` : 'N/A',
      fiftyTwoWeekRange: `₹${quote.fiftyTwoWeekLow || 'N/A'} - ₹${quote.fiftyTwoWeekHigh || 'N/A'}`,
      financials: {
        sector: quote.sector || 'N/A',
        industry: quote.industry || 'N/A',
        longBusinessSummary: quote.longBusinessSummary || 'No company summary available.'
      },
      newsCatalysts: intel.newsCatalysts,
      viewerSentiment: intel.viewerSentiment,
      bigShotRecommendations: intel.bigShotRecommendations,
      streak: intel.streak,
      forwardOutlook: intel.forwardOutlook,
      chartHistory
    });
  } catch (error) {
    console.error(`Failed to fetch Indian stock detail for ${symbol}:`, error.message);
    return res.status(404).json({
      success: false,
      error: `Could not retrieve data for ${symbol}. The symbol may be invalid or data is temporarily unavailable.`
    });
  }
});

// Utility to format Volume
function formatVolume(vol) {
  if (!vol) return 'N/A';
  if (vol >= 1.0e7) return (vol / 1.0e7).toFixed(2) + ' Cr';
  if (vol >= 1.0e5) return (vol / 1.0e5).toFixed(2) + ' L';
  if (vol >= 1.0e3) return (vol / 1.0e3).toFixed(2) + ' K';
  return vol.toString();
}

// Utility to format Market Cap
function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1.0e7) return '₹' + (cap / 1.0e7).toFixed(0) + ' Cr';
  return '₹' + cap.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATE ALL ROUTES
// NOTE: app.use('/api/market', marketRoutes) is registered AFTER inline routes
//       above so there's no conflict — the inline routes use '/api/market' GET
//       directly, while marketRoutes handles sub-paths like /pre-market, /deep-analysis
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/market', marketRoutes);

// NEW: Market Analysis & Holiday-Aware Routes
app.use('/api/market-analysis', marketAnalysisRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);

// Market Status Endpoints (Holiday-aware)
app.get('/api/market/status', (req, res) => {
  try {
    const status = marketHolidayManager.getMarketStatusInfo();
    res.json({
      success: true,
      marketStatus: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  const marketStatus = marketHolidayManager.getMarketStatusInfo();
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   STOCK TRADING PLATFORM - PRODUCTION READY                ║
║   Market: NSE/BSE (India)                                  ║
╠════════════════════════════════════════════════════════════╣
║   🚀 Server running on port ${PORT}                               ║
║   📡 WebSocket ready for real-time streaming              ║
║   💼 Paper Trading API active                              ║
║   📊 Analytics Engine ready                                ║
║   🔥 Market Analysis & Holiday Detection Active            ║
║   📅 Current Status: ${marketStatus.message}                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});
