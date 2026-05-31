/**
 * Curated pool of major Indian equity NSE/BSE ticker symbols.
 * Used as a DYNAMIC FALLBACK POOL only when live scraping fails.
 * These are ONLY ticker symbols — zero hardcoded prices or company data.
 * All prices, quotes, and company data are fetched live from Yahoo Finance.
 */

// Nifty 50 Index Constituents (NSE)
const NIFTY50_SYMBOLS = [
  'ADANIENT.NS',   // Adani Enterprises
  'ADANIPORTS.NS', // Adani Ports
  'APOLLOHOSP.NS', // Apollo Hospitals
  'ASIANPAINT.NS', // Asian Paints
  'AXISBANK.NS',   // Axis Bank
  'BAJAJ-AUTO.NS', // Bajaj Auto
  'BAJAJFINSV.NS', // Bajaj Finserv
  'BAJFINANCE.NS', // Bajaj Finance
  'BHARTIARTL.NS', // Bharti Airtel
  'BPCL.NS',       // Bharat Petroleum
  'BRITANNIA.NS',  // Britannia Industries
  'CIPLA.NS',      // Cipla
  'COALINDIA.NS',  // Coal India
  'DIVISLAB.NS',   // Divi's Laboratories
  'DRREDDY.NS',    // Dr. Reddy's
  'EICHERMOT.NS',  // Eicher Motors
  'GRASIM.NS',     // Grasim Industries
  'HCLTECH.NS',    // HCL Technologies
  'HDFCBANK.NS',   // HDFC Bank
  'HDFCLIFE.NS',   // HDFC Life
  'HEROMOTOCO.NS', // Hero MotoCorp
  'HINDALCO.NS',   // Hindalco Industries
  'HINDUNILVR.NS', // Hindustan Unilever
  'ICICIBANK.NS',  // ICICI Bank
  'INDUSINDBK.NS', // IndusInd Bank
  'INFY.NS',       // Infosys
  'ITC.NS',        // ITC Limited
  'JSWSTEEL.NS',   // JSW Steel
  'KOTAKBANK.NS',  // Kotak Mahindra Bank
  'LT.NS',         // Larsen & Toubro
  'M&M.NS',        // Mahindra & Mahindra
  'MARUTI.NS',     // Maruti Suzuki
  'NESTLEIND.NS',  // Nestle India
  'NTPC.NS',       // NTPC
  'ONGC.NS',       // ONGC
  'POWERGRID.NS',  // Power Grid
  'RELIANCE.NS',   // Reliance Industries
  'SBILIFE.NS',    // SBI Life Insurance
  'SBIN.NS',       // State Bank of India
  'SUNPHARMA.NS',  // Sun Pharmaceutical
  'TATACONSUM.NS', // Tata Consumer
  'TATAMOTORS.NS', // Tata Motors
  'TATASTEEL.NS',  // Tata Steel
  'TCS.NS',        // Tata Consultancy Services
  'TECHM.NS',      // Tech Mahindra
  'TITAN.NS',      // Titan Company
  'ULTRACEMCO.NS', // UltraTech Cement
  'UPL.NS',        // UPL
  'WIPRO.NS',      // Wipro
  'ZOMATO.NS',     // Zomato
];

// Nifty Next 50 / Midcap additions
const NIFTY_NEXT50_SYMBOLS = [
  'ABB.NS',
  'AMBUJACEM.NS',
  'AUROPHARMA.NS',
  'BANDHANBNK.NS',
  'BANKBARODA.NS',
  'BERGEPAINT.NS',
  'BIOCON.NS',
  'BOSCHLTD.NS',
  'CANBK.NS',
  'CHOLAFIN.NS',
  'COLPAL.NS',
  'CONCOR.NS',
  'CUMMINSIND.NS',
  'DABUR.NS',
  'DMART.NS',
  'GAIL.NS',
  'GODREJCP.NS',
  'GODREJPROP.NS',
  'HAL.NS',
  'HAVELLS.NS',
  'ICICIGI.NS',
  'ICICIPRULI.NS',
  'IDFCFIRSTB.NS',
  'IGL.NS',
  'INDIGO.NS',
  'IOC.NS',
  'LTI.NS',
  'LUPIN.NS',
  'MCDOWELL-N.NS',
  'MFSL.NS',
  'MPHASIS.NS',
  'MRF.NS',
  'NMDC.NS',
  'PERSISTENT.NS',
  'PETRONET.NS',
  'PIDILITIND.NS',
  'PIIND.NS',
  'PNB.NS',
  'SBICARD.NS',
  'SHREECEM.NS',
  'SIEMENS.NS',
  'SRF.NS',
  'TORNTPHARM.NS',
  'TRENT.NS',
  'UBL.NS',
  'VOLTAS.NS',
];

// Combined full universe for recommendation engine
const FULL_SYMBOL_POOL = [...NIFTY50_SYMBOLS, ...NIFTY_NEXT50_SYMBOLS];

/**
 * Get a randomized subset of symbols from the full pool.
 * Used to diversify recommendations across sessions.
 * @param {number} count - Number of symbols to return
 * @returns {string[]}
 */
function getRandomSymbols(count = 20) {
  const shuffled = [...FULL_SYMBOL_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get Nifty 50 symbols only.
 * @returns {string[]}
 */
function getNifty50Symbols() {
  return [...NIFTY50_SYMBOLS];
}

module.exports = {
  NIFTY50_SYMBOLS,
  NIFTY_NEXT50_SYMBOLS,
  FULL_SYMBOL_POOL,
  getRandomSymbols,
  getNifty50Symbols
};
