let yahooFinanceInstance = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const module = await import('yahoo-finance2');
    yahooFinanceInstance = module.default;
  }
  return yahooFinanceInstance;
}

module.exports = {
  getYahooFinance
};
