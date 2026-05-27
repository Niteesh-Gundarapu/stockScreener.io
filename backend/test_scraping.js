const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function testYahooFinanceChart() {
  console.log('--- Testing Yahoo Finance chart() Module ---');
  
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    console.log('Fetching Chart for AAPL...');
    const chartData = await yahooFinance.chart('AAPL', {
      period1: thirtyDaysAgo, // Pass Date object directly
      period2: today,        // Pass Date object directly
      interval: '1d'
    });
    
    console.log('Success! Chart data retrieved.');
    console.log('Ticker:', chartData.meta.symbol);
    console.log('Number of data points:', chartData.quotes.length);
    console.log('Last data point:', chartData.quotes[chartData.quotes.length - 1]);
  } catch (error) {
    console.error('Yahoo Finance Chart Error:', error.message, error.errors);
  }
}

testYahooFinanceChart();
