const axios = require('axios');
const { getYahooFinance } = require('./utils/yahooClient');
const { getNifty50Symbols, getRandomSymbols } = require('./utils/niftySymbols');
const NSEDataService = require('./services/nseDataService');

let nseDataService;

/**
 * Initialize NSE Data Service
 */
function initializeNSEService() {
  if (!nseDataService) {
    nseDataService = new NSEDataService();
  }
  return nseDataService;
}

/**
 * Maps a company name to its corresponding Yahoo Finance NSE or BSE ticker symbol
 */
async function searchIndianTicker(companyName) {
  if (!companyName) return null;
  
  // Clean up common shorthand names to improve search matches
  const cleanName = companyName
    .replace(/ Ltd\.?/gi, '')
    .replace(/ India/gi, '')
    .replace(/ Co\.?/gi, '')
    .trim();
    
  try {
    const yahooFinance = await getYahooFinance();
    const searchResult = await yahooFinance.search(cleanName);
    const quotes = searchResult.quotes || [];
    
    // Filter for Indian NSE/BSE symbols (ending in .NS or .BO)
    const indianQuotes = quotes.filter(q => 
      q.symbol && typeof q.symbol === 'string' && 
      (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))
    );
    
    if (indianQuotes.length > 0) {
      // Prioritize NSE (.NS) over BSE (.BO) if available
      const nseMatch = indianQuotes.find(q => q.symbol.endsWith('.NS'));
      return nseMatch ? nseMatch.symbol : indianQuotes[0].symbol;
    }
  } catch (error) {
    console.error(`Error searching ticker for "${companyName}":`, error.message);
  }
  return null;
}

/**
 * Get top gainers from reliable NSE API service
 * Replaces Moneycontrol scraping with API-based data
 */
async function scrapeMoneycontrolCategory(categoryType) {
  try {
    const service = initializeNSEService();
    
    if (categoryType === 'Top Gainers') {
      return await service.getTopGainers();
    } else if (categoryType === 'Top Losers') {
      return await service.getTopLosers();
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching ${categoryType}:`, error.message);
    // Fallback to Yahoo Finance
    return await fetchYahooFinanceMoversFallback(
      categoryType === 'Top Gainers' ? 'gainers' : 'losers'
    );
  }
}


/**
 * Fetches live Nifty 50 market leaders with real-time quotes from NSE/Yahoo Finance.
 * Uses API service for reliable data.
 */
async function getNiftyMarketLeaders() {
  try {
    const service = initializeNSEService();
    const leaders = [];
    const symbols = getNifty50Symbols().slice(0, 15);
    
    const quotes = await service.getMultipleQuotes(symbols);
    return quotes;
  } catch (error) {
    console.error('Error fetching Nifty market leaders:', error.message);
    // Fallback: return empty array and let service handle retry
    return [];
  }
}

/**
 * Fetches top gainers / losers dynamically from NSE API or Yahoo Finance fallback.
 * @param {'gainers'|'losers'} type
 * @returns {Array}
 */
async function fetchYahooFinanceMoversFallback(type = 'gainers') {
  const yahooFinance = await getYahooFinance();
  const results = [];
  
  // Use a focused subset of top blue chips for fast response
  const symbols = getNifty50Symbols().slice(0, 20);
  const quotes = [];
  
  for (const symbol of symbols) {
    try {
      const q = await yahooFinance.quote(symbol);
      if (!q || !q.regularMarketPrice) continue;
      quotes.push({
        ticker: symbol,
        company: q.longName || q.shortName || symbol.replace('.NS', ''),
        price: q.regularMarketPrice,
        change: `${(q.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(q.regularMarketChangePercent || 0).toFixed(2)}%`,
        changePercent: q.regularMarketChangePercent || 0,
        high: q.regularMarketDayHigh || q.regularMarketPrice,
        low: q.regularMarketDayLow || q.regularMarketPrice,
        volume: formatVolume(q.regularMarketVolume),
        country: 'India',
        industry: q.industry || 'N/A'
      });
    } catch (e) {
      // Skip failed quotes
    }
  }
  
  // Sort by absolute change percent
  quotes.sort((a, b) => {
    if (type === 'gainers') return b.changePercent - a.changePercent;
    return a.changePercent - b.changePercent;
  });
  
  return quotes.slice(0, 15);
}

// Utility to format Volume in Lakhs/Crores or Standard suffixes for Indian markets
function formatVolume(vol) {
  if (!vol) return 'N/A';
  if (vol >= 1.0e7) return (vol / 1.0e7).toFixed(2) + ' Cr';
  if (vol >= 1.0e5) return (vol / 1.0e5).toFixed(2) + ' L';
  if (vol >= 1.0e3) return (vol / 1.0e3).toFixed(2) + ' K';
  return vol.toString();
}

// Utility to format Market Cap in Crores/Trillions
function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1.0e7) return '₹' + (cap / 1.0e7).toFixed(0) + ' Cr';
  return '₹' + cap.toString();
}

module.exports = {
  scrapeMoneycontrolCategory,
  getNiftyMarketLeaders,
  searchIndianTicker,
  fetchYahooFinanceMoversFallback,
  formatVolume,
  formatMarketCap,
  initializeNSEService
};

