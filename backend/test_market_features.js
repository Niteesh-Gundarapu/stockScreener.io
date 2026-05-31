const MarketService = require('./services/marketService');
const RecommendationService = require('./services/recommendationService');

async function runTests() {
  const marketService = new MarketService();
  const recommendationService = new RecommendationService();
  const tickers = ['RELIANCE.NS', 'INFY.NS', 'TCS.NS', 'HDFCBANK.NS'];

  console.log('=== Running Backend Market Feature Smoke Tests ===');

  try {
    console.log('\n1) Pre-market snapshot');
    const snapshot = await marketService.getPreMarketSnapshot(tickers);
    console.log(JSON.stringify(snapshot.slice(0, 3), null, 2));

    console.log('\n2) Deep market analysis');
    const analysis = await marketService.getDeepMarketAnalysis(tickers);
    console.log(JSON.stringify({ avoidList: analysis.avoidList, checkList: analysis.checkList }, null, 2));

    console.log('\n3) Daily recommendations');
    const recommendations = await recommendationService.generateSmartRecommendations(tickers, analysis.avoidList);
    console.log(JSON.stringify(recommendations.slice(0, 5), null, 2));

    console.log('\n✅ Backend market feature smoke tests completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failure:', error.message);
    process.exit(1);
  }
}

runTests();
