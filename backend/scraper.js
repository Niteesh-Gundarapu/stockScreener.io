const axios = require('axios');
const cheerio = require('cheerio');
const { getYahooFinance } = require('./utils/yahooClient');

// Curated list of prominent Nifty 50 Blue Chips to track as Market Leaders
const NIFTY_BLUE_CHIPS = [
  'RELIANCE.NS', // Reliance Industries
  'TCS.NS',      // Tata Consultancy Services
  'HDFCBANK.NS', // HDFC Bank
  'INFY.NS',     // Infosys
  'SBIN.NS',     // State Bank of India
  'TATAMOTORS.NS', // Tata Motors
  'ICICIBANK.NS', // ICICI Bank
  'LT.NS',       // Larsen & Toubro
  'ITC.NS',      // ITC Limited
  'BHARTIARTL.NS', // Bharti Airtel
  'AXISBANK.NS', // Axis Bank
  'TATASTEEL.NS', // Tata Steel
  'WIPRO.NS',    // Wipro
  'HCLTECH.NS',  // HCL Technologies
  'ADANIENT.NS'  // Adani Enterprises
];

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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
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
        // Format of span text: "1.68 (9.41%)" or "-75.10 (-10.67%)"
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
        const volume = cells.eq(6).text().trim() || 'N/A'; // VWAP or Volume

        if (companyName && priceVal) {
          stocks.push({
            tickerName: companyName, // Keep Moneycontrol name to resolve later
            company: companyName,
            price: parseFloat(priceVal.replace(/,/g, '')) || priceVal,
            change: changeTextVal ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '0.00%',
            changePercent: changePercent,
            changeRupees: changeRupees,
            high: parseFloat(high.replace(/,/g, '')) || high,
            low: parseFloat(low.replace(/,/g, '')) || low,
            volume: volume,
            country: 'India',
            industry: 'N/A' // Resolved later in recommendation engine
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
 * Compiles a live list of Nifty 50 leaders with real-time stats
 */
async function getNiftyMarketLeaders() {
  const leaders = [];
  
  for (const symbol of NIFTY_BLUE_CHIPS) {
    try {
      const q = await yahooFinance.quote(symbol);
      leaders.push({
        ticker: symbol,
        company: q.longName || q.shortName || symbol.replace('.NS', ''),
        price: q.regularMarketPrice || 0,
        change: `${q.regularMarketChangePercent >= 0 ? '+' : ''}${q.regularMarketChangePercent?.toFixed(2)}%` || '0.00%',
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

// Utility to format Volume in Lakhs/Crores or Standard suffixes for Indian markets
function formatVolume(vol) {
  if (!vol) return 'N/A';
  if (vol >= 1.0e7) return (vol / 1.0e7).toFixed(2) + ' Cr'; // 1 Crore = 10 Million
  if (vol >= 1.0e5) return (vol / 1.0e5).toFixed(2) + ' L';  // 1 Lakh = 100,000
  if (vol >= 1.0e3) return (vol / 1.0e3).toFixed(2) + ' K';
  return vol.toString();
}

// Utility to format Market Cap in Crores/Trillions
function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  // Convert INR market cap to Crores (1 Crore = 10^7 Rupees)
  if (cap >= 1.0e7) return '₹' + (cap / 1.0e7).toFixed(0) + ' Cr';
  return '₹' + cap.toString();
}

module.exports = {
  scrapeMoneycontrolCategory,
  getNiftyMarketLeaders,
  searchIndianTicker,
  formatVolume,
  formatMarketCap
};
