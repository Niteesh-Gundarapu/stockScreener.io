const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function testNewsAndRecommendations() {
  console.log('--- Testing News & Big Shot Recommendations for Indian Markets ---');
  
  const symbol = 'TATAMOTORS.NS'; // Let's test with Tata Motors
  
  try {
    // Test 1: Fetching News for the Ticker
    console.log(`\n1. Fetching live News for ${symbol}...`);
    const searchResult = await yahooFinance.search(symbol);
    const news = searchResult.news || [];
    console.log(`Success! Found ${news.length} news articles.`);
    news.slice(0, 3).forEach((n, i) => {
      console.log(`[Article ${i+1}] Title: "${n.title}"`);
      console.log(`   Publisher: ${n.publisher} | Date: ${n.uuid}`);
      console.log(`   Link: ${n.link}`);
    });
    
    // Test 2: Fetching Recommendation Trends (Analyst consensus)
    console.log(`\n2. Fetching Analyst Recommendation Trends for ${symbol}...`);
    // Quote summary has a module called 'recommendationTrend'
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['recommendationTrend', 'upgradeDowngradeHistory']
    }).catch(e => {
      console.log('Quote Summary recommendationTrend failed, trying fallback...');
      return null;
    });
    
    if (summary && summary.recommendationTrend) {
      console.log('Success! Found Analyst Recommendations Trend:');
      const trend = summary.recommendationTrend.trend || [];
      console.log(JSON.stringify(trend.slice(0, 2), null, 2));
    } else {
      console.log('No direct analyst trend found in quoteSummary.');
    }

    // Let's test standard quote analyst recommendations
    const quote = await yahooFinance.quote(symbol);
    console.log(`\n3. Quote recommendation fields:`);
    console.log(`   Average Analyst Rating: ${quote.averageAnalystRating || 'N/A'}`);
    console.log(`   Target Mean Price: ₹${quote.targetMeanPrice || 'N/A'}`);
    console.log(`   Target High Price: ₹${quote.targetHighPrice || 'N/A'}`);
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

testNewsAndRecommendations();
