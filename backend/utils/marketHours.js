// backend/utils/marketHours.js
// Indian stock market hours (NSE/BSE)
// Market: 9:15 AM - 3:30 PM IST (Monday-Friday, excluding holidays)

const pino = require('pino');
const logger = pino();

// NSE Market Hours (in IST)
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 15;
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30;

// IST is UTC+5:30
const IST_OFFSET_HOURS = 5.5;

/**
 * Get current time in IST
 */
function getCurrentTimeIST() {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istTime = new Date(utcTime + IST_OFFSET_HOURS * 60 * 60 * 1000);
  return istTime;
}

/**
 * Check if market is currently open
 * Returns true only if: Monday-Friday, 9:15 AM - 3:30 PM IST
 */
function isMarketOpen() {
  const now = getCurrentTimeIST();

  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = now.getDay();

  // Market closed on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    logger.debug('Market closed: weekend');
    return false;
  }

  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Convert to minutes since midnight for easier comparison
  const currentMinutes = hours * 60 + minutes;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE; // 9:15 = 555 minutes
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE; // 15:30 = 930 minutes

  const isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;

  if (!isOpen) {
    logger.debug(
      { currentTime: `${hours}:${minutes}`, openTime: '9:15', closeTime: '15:30' },
      'Market closed: outside trading hours'
    );
  }

  return isOpen;
}

/**
 * Get minutes until market opens
 * Returns 0 if market is already open
 */
function getMinutesUntilOpen() {
  const now = getCurrentTimeIST();
  const dayOfWeek = now.getDay();

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;

  // Already open
  if (isMarketOpen()) {
    return 0;
  }

  // Same day, before open
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && currentMinutes < openMinutes) {
    return openMinutes - currentMinutes;
  }

  // After market close or weekend
  // Find next market open day
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDayOfWeek = tomorrow.getDay();

  let daysUntilOpen = 1;
  let nextOpenDay = tomorrow;

  // Skip to next Monday-Friday
  if (nextDayOfWeek === 0) {
    // Tomorrow is Sunday, open on Monday
    daysUntilOpen = 2;
    nextOpenDay = new Date(tomorrow);
    nextOpenDay.setDate(nextOpenDay.getDate() + 1);
  } else if (nextDayOfWeek === 6) {
    // Tomorrow is Saturday, open on Monday
    daysUntilOpen = 2;
    nextOpenDay = new Date(tomorrow);
    nextOpenDay.setDate(nextOpenDay.getDate() + 2);
  }

  // Calculate minutes
  const nextOpen = new Date(nextOpenDay);
  nextOpen.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);

  const minutesUntilOpen = Math.ceil((nextOpen - now) / (1000 * 60));
  return Math.max(0, minutesUntilOpen);
}

/**
 * Get minutes until market closes
 * Returns 0 if market is already closed
 */
function getMinutesUntilClose() {
  if (!isMarketOpen()) {
    return 0;
  }

  const now = getCurrentTimeIST();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  return Math.max(0, closeMinutes - currentMinutes);
}

module.exports = {
  isMarketOpen,
  getMinutesUntilOpen,
  getMinutesUntilClose,
  getCurrentTimeIST,
  MARKET_OPEN_HOUR,
  MARKET_OPEN_MINUTE,
  MARKET_CLOSE_HOUR,
  MARKET_CLOSE_MINUTE,
};
