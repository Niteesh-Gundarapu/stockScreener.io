let yahooFinanceInstance = null;

async function getYahooFinance() {
  if (yahooFinanceInstance) return yahooFinanceInstance;

  // Load yahoo-finance2 default export which provides functions like search/quote/chart
  const mod = await import('yahoo-finance2').catch((e) => {
    console.warn('Failed to import yahoo-finance2:', e && e.message);
    return null;
  });

  if (!mod) return null;

  // Resolve possible export shapes (named exports, default wrapper, or constructor)
  const raw = mod.default || mod;
  // If the module doesn't expose expected functions, try require fallback
  let fallbackRequire = null;
  try {
    fallbackRequire = require('yahoo-finance2');
  } catch (e) {
    // ignore
  }

  // Handle case where the package exports a constructor/function that must be instantiated
  let instance = raw;
  try {
    if (typeof raw === 'function') {
      // prefer calling as a factory, otherwise try `new`
      try {
        instance = raw({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
      } catch (e) {
        try {
          instance = new raw({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
        } catch (e2) {
          // fall back to raw
          instance = raw;
        }
      }
    }
  } catch (e) {
    instance = raw;
  }

  yahooFinanceInstance = instance;

  // In-memory TTL cache to avoid repeated requests for same tickers/queries
  const cache = new Map(); // key -> { ts, ttl, value }
  const DEFAULT_TTL = 15 * 1000; // 15 seconds for quotes/search

  // Simple serialized queue to keep requests spaced and reduce 429s
  let lastRequestTime = 0;
  const MIN_INTERVAL = 350; // ms between requests

  const schedule = async (fn) => {
    const now = Date.now();
    const delta = Math.max(0, MIN_INTERVAL - (now - lastRequestTime));
    if (delta > 0) await new Promise(r => setTimeout(r, delta));
    lastRequestTime = Date.now();
    return fn();
  };

  // Wrapper with retry + schedule
  const wrap = (fn, opts = {}) => async (...args) => {
    const cacheKey = opts.cacheKey ? `${opts.cacheKey}:${JSON.stringify(args)}` : null;
    if (cacheKey && cache.has(cacheKey)) {
      const entry = cache.get(cacheKey);
      if (Date.now() - entry.ts < (entry.ttl || DEFAULT_TTL)) {
        return entry.value;
      }
      cache.delete(cacheKey);
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await schedule(() => fn(...args));
        if (cacheKey) cache.set(cacheKey, { ts: Date.now(), ttl: opts.ttl || DEFAULT_TTL, value: result });
        return result;
      } catch (err) {
        const status = err && err.status;
        if (status === 429 && attempt < maxAttempts) {
          const backoff = 400 * attempt;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw err;
      }
    }
  };

  // Wrap commonly used functions with caching where appropriate
  const client = {};
  const resolver = (name) => {
    if (yahooFinanceInstance && typeof yahooFinanceInstance[name] === 'function') return yahooFinanceInstance[name].bind(yahooFinanceInstance);
    if (mod[name] && typeof mod[name] === 'function') return mod[name].bind(mod);
    if (fallbackRequire && typeof fallbackRequire[name] === 'function') return fallbackRequire[name].bind(fallbackRequire);
    return null;
  };

  const qFn = resolver('search'); if (qFn) client.search = wrap(qFn, { cacheKey: 'search', ttl: 30 * 1000 });
  const quoteFn = resolver('quote'); if (quoteFn) client.quote = wrap(quoteFn, { cacheKey: 'quote', ttl: 15 * 1000 });
  const chartFn = resolver('chart'); if (chartFn) client.chart = wrap(chartFn, { cacheKey: 'chart', ttl: 60 * 1000 });
  const quotesFn = resolver('quotes'); if (quotesFn) client.quotes = wrap(quotesFn, { cacheKey: 'quotes', ttl: 15 * 1000 });
  const summaryFn = resolver('quoteSummary'); if (summaryFn) client.quoteSummary = wrap(summaryFn, { cacheKey: 'summary', ttl: 30 * 1000 });

  // Expose any other functions directly but scheduled
  if (yahooFinanceInstance && typeof yahooFinanceInstance === 'object') {
    Object.keys(yahooFinanceInstance).forEach((k) => {
      if (!client[k] && typeof yahooFinanceInstance[k] === 'function') {
        client[k] = (...args) => schedule(() => yahooFinanceInstance[k](...args));
      }
    });
  }

  return client;
}

module.exports = { getYahooFinance };
