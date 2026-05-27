const axios = require('axios');
const cheerio = require('cheerio');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function testSymbolMapping() {
  console.log('--- Testing Moneycontrol Name to NSE Ticker Search ---');
  
  const testCompanies = ['Jaiprakash Pow', 'Kirloskar Oil', 'Saregama India', 'Chambal Fert'];
  
  for (const name of testCompanies) {
    try {
      console.log(`\nSearching ticker for: "${name}"...`);
      const searchResult = await yahooFinance.search(name);
      
      // Filter for Indian NSE/BSE quotes (usually end with .NS or .BO)
      const indianQuotes = (searchResult.quotes || []).filter(q => 
        q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')
      );
      
      if (indianQuotes.length > 0) {
        const bestMatch = indianQuotes[0];
        console.log(`Success! Best Match Symbol: ${bestMatch.symbol} (${bestMatch.longname || bestMatch.shortname})`);
        
        // Fetch real-time quote to verify
        const quote = await yahooFinance.quote(bestMatch.symbol);
        console.log(`Live Price: ₹${quote.regularMarketPrice} | Change: ${quote.regularMarketChangePercent?.toFixed(2)}%`);
      } else {
        console.log(`No Indian symbol found for: ${name}`);
      }
    } catch (e) {
      console.error(`Search error for ${name}:`, e.message);
    }
  }
}

testSymbolMapping();
