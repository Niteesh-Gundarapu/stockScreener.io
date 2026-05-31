let yahooFinanceInstance = null;

async function getYahooFinance() {
  if (yahooFinanceInstance) return yahooFinanceInstance;

  // Load yahoo-finance2 default export which provides functions like search/quote/chart
  const mod = await import('yahoo-finance2').catch((e) => {
    console.warn('Failed to import yahoo-finance2:', e && e.message);
    return null;
  });

  if (!mod) return null;

  yahooFinanceInstance = mod.default || mod;

  // Simple wrapper to retry on transient 429 errors
  const wrap = (fn) => async (...args) => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        const status = err && err.status;
        if (status === 429 && attempt < maxAttempts) {
          const backoff = 300 * attempt;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw err;
      }
    }
  };

  // Wrap commonly used functions
  const client = {};
  ['search','quote','chart','quotes','historical','quoteSummary'].forEach((name) => {
    if (typeof yahooFinanceInstance[name] === 'function') {
      client[name] = wrap(yahooFinanceInstance[name].bind(yahooFinanceInstance));
    }
  });

  // Fall back to whole module if some functions missing
  return Object.assign(yahooFinanceInstance, client);
}

module.exports = { getYahooFinance };
