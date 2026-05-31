const axios = require('axios');
const cheerio = require('cheerio');
const { getYahooFinance } = require('./utils/yahooClient');
const { getNifty50Symbols, getRandomSymbols } = require('./utils/niftySymbols');

/**
 * Maps a Moneycontrol company name to its corresponding Yahoo Finance NSE or BSE ticker symbol
 */
async function searchIndianTicker(companyName) {
  if (!companyName) return null;
  
  // Clean up common Moneycontrol shorthand names to improve search matches
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
 * Scrapes Moneycontrol's market stats pages for Indian stocks.
 * Supports "Top Gainers" and "Top Losers".
 */
async function scrapeMoneycontrolCategory(categoryType) {
  const urlMap = {
    'Top Gainers': 'https://www.moneycontrol.com/stocks/marketstats/nsegainer/index.php',
    'Top Losers': 'https://www.moneycontrol.com/stocks/marketstats/nseloser/index.php'
  };

  const url = urlMap[categoryType];
  if (!url) return [];

  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });

    const $ = cheerio.load(response.data);
    const stocks = [];

    // Find table rows containing stock quote links
    $('a[href*="/india/stockpricequote/"]').each((i, el) => {
      const row = $(el).closest('tr');
      const cells = row.find('td');
      
      if (cells.length >= 4) {
        const companyName = $(el).text().trim();
        
        // Col 2 contains the Price and the Change metrics inside a <p> tag
        const priceTd = cells.eq(2);
        const pTag = priceTd.find('p');
        
        // Extract the price before the span tag
        let priceVal = pTag.contents().first().text().trim();
        
        // Extract the change details inside the span
        const changeSpan = pTag.find('span');
        const changeTextVal = changeSpan.text().trim();
        
        // Clean up change percentage and numeric formats
        let changePercent = 0;
        let changeRupees = '0.00';
        
        if (changeTextVal) {
          const match = changeTextVal.match(/(-?[\d,.]+)\s*\(\s*(-?[\d,.]+)%\s*\)/);
          if (match) {
            changeRupees = match[1];
            changePercent = parseFloat(match[2]) || 0;
          }
        }
        
        // High & Low are in Col 3 and Col 4
        const high = cells.eq(3).text().trim();
        const low = cells.eq(4).text().trim();
        const volume = cells.eq(6).text().trim() || 'N/A';

        if (companyName && priceVal) {
          stocks.push({
            tickerName: companyName,
            company: companyName,
            price: parseFloat(priceVal.replace(/,/g, '')) || priceVal,
            change: changeTextVal ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '0.00%',
            changePercent: changePercent,
            changeRupees: changeRupees,
            high: parseFloat(high.replace(/,/g, '')) || high,
            low: parseFloat(low.replace(/,/g, '')) || low,
            volume: volume,
            country: 'India',
            industry: 'N/A'
          });
        }
      }
    });

    // Take top 15 to keep it fast
    return stocks.slice(0, 15);
  } catch (error) {
    console.error(`Error scraping Moneycontrol category "${categoryType}":`, error.message);
    throw error;
  }
}

/**
 * Fetches live Nifty 50 market leaders with real-time quotes from Yahoo Finance.
 * Uses the curated symbol pool — no hardcoded prices.
 */
async function getNiftyMarketLeaders() {
  const yahooFinance = await getYahooFinance(); // FIXED: was missing this call
  const leaders = [];
  // Use only top 15 blue chips for fast response
  const symbols = getNifty50Symbols().slice(0, 15);
  
  for (const symbol of symbols) {
    try {
      const q = await yahooFinance.quote(symbol);
      if (!q || !q.regularMarketPrice) continue;
      leaders.push({
        ticker: symbol,
        company: q.longName || q.shortName || symbol.replace('.NS', ''),
        price: q.regularMarketPrice || 0,
        change: `${(q.regularMarketChangePercent || 0) >= 0 ? '+' : ''}${(q.regularMarketChangePercent || 0).toFixed(2)}%`,
        changePercent: q.regularMarketChangePercent || 0,
        volume: formatVolume(q.regularMarketVolume),
        marketCap: formatMarketCap(q.marketCap),
        industry: q.industry || 'Blue Chip',
        country: 'India'
      });
    } catch (e) {
      console.error(`Failed to fetch Nifty leader quote for ${symbol}:`, e.message);
    }
  }
  
  return leaders;
}

/**
 * Fetches top gainers / losers dynamically from Yahoo Finance screener as a fallback.
 * Called when Moneycontrol scraping fails.
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
  formatMarketCap
};
