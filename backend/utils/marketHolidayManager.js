// backend/utils/marketHolidayManager.js
// Manages NSE/BSE market holidays and provides historical data fallback

const pino = require('pino');
const logger = pino();

const MARKET_HOLIDAYS_2024_2025 = [
  // Republic Day
  { date: '2024-01-26', name: 'Republic Day' },
  // Holi
  { date: '2024-03-25', name: 'Holi' },
  // Good Friday
  { date: '2024-03-29', name: 'Good Friday' },
  // Ambedkar Jayanti
  { date: '2024-04-17', name: 'Dr. Ambedkar Jayanti' },
  // Eid ul-Fitr
  { date: '2024-04-11', name: 'Eid ul-Fitr' },
  // Buddha Purnima
  { date: '2024-05-23', name: 'Buddha Purnima' },
  // Eid ul-Adha
  { date: '2024-06-17', name: 'Eid ul-Adha' },
  // Muharram
  { date: '2024-07-16', name: 'Muharram' },
  // Independence Day
  { date: '2024-08-15', name: 'Independence Day' },
  // Janmashtami
  { date: '2024-08-26', name: 'Janmashtami' },
  // Ganesh Chaturthi
  { date: '2024-09-07', name: 'Ganesh Chaturthi' },
  // Gandhi Jayanti
  { date: '2024-10-02', name: 'Gandhi Jayanti' },
  // Dussehra
  { date: '2024-10-12', name: 'Dussehra' },
  // Diwali
  { date: '2024-11-01', name: 'Diwali (Lakshmi Puja)' },
  { date: '2024-11-02', name: 'Diwali (Govardhan Puja)' },
  // Christmas
  { date: '2024-12-25', name: 'Christmas' },
  // New Year 2025
  { date: '2025-01-01', name: 'New Year' },
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-03-14', name: 'Holi' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Eid ul-Fitr' },
  { date: '2025-05-23', name: 'Buddha Purnima' },
  { date: '2025-06-07', name: 'Eid ul-Adha' },
  { date: '2025-07-06', name: 'Muharram' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-08-16', name: 'Janmashtami' },
  { date: '2025-08-29', name: 'Ganesh Chaturthi' },
  { date: '2025-10-02', name: 'Gandhi Jayanti' },
  { date: '2025-10-20', name: 'Dussehra' },
  { date: '2025-10-20', name: 'Diwali' },
  { date: '2025-12-25', name: 'Christmas' },
];

class MarketHolidayManager {
  constructor() {
    this.holidays = new Set(MARKET_HOLIDAYS_2024_2025.map(h => h.date));
    this.holidayMap = new Map(MARKET_HOLIDAYS_2024_2025.map(h => [h.date, h.name]));
  }

  /**
   * Check if a given date is a market holiday
   */
  isMarketHoliday(dateString) {
    return this.holidays.has(dateString);
  }

  /**
   * Get the name of the holiday
   */
  getHolidayName(dateString) {
    return this.holidayMap.get(dateString) || null;
  }

  /**
   * Get the last trading day (skip weekends and holidays)
   */
  getLastTradingDay(fromDate = new Date()) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() - 1);

    while (true) {
      const dayOfWeek = date.getDay();
      const dateString = date.toISOString().split('T')[0];

      // Skip if weekend (0=Sunday, 6=Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        date.setDate(date.getDate() - 1);
        continue;
      }

      // Skip if holiday
      if (this.isMarketHoliday(dateString)) {
        date.setDate(date.getDate() - 1);
        continue;
      }

      // Found valid trading day
      return date;
    }
  }

  /**
   * Get the next trading day (skip weekends and holidays)
   */
  getNextTradingDay(fromDate = new Date()) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);

    while (true) {
      const dayOfWeek = date.getDay();
      const dateString = date.toISOString().split('T')[0];

      // Skip if weekend (0=Sunday, 6=Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        date.setDate(date.getDate() + 1);
        continue;
      }

      // Skip if holiday
      if (this.isMarketHoliday(dateString)) {
        date.setDate(date.getDate() + 1);
        continue;
      }

      // Found valid trading day
      return date;
    }
  }

  /**
   * Check if today is a market holiday or weekend
   */
  isMarketClosedToday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateString = today.toISOString().split('T')[0];

    // Check if weekend or holiday
    return (dayOfWeek === 0 || dayOfWeek === 6) || this.isMarketHoliday(dateString);
  }

  /**
   * Get market status info for today
   */
  getMarketStatusInfo() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isOpen: false,
        reason: 'weekend',
        dayName,
        message: `Market closed - ${dayName}`,
      };
    }

    const holidayName = this.getHolidayName(dateString);
    if (holidayName) {
      return {
        isOpen: false,
        reason: 'holiday',
        holidayName,
        message: `Market closed - ${holidayName}`,
      };
    }

    return {
      isOpen: true,
      reason: null,
      dayName,
      message: 'Market is open',
    };
  }

  /**
   * Get previous trading day info for fallback data
   */
  getPreviousTradingDayInfo() {
    const lastTradingDay = this.getLastTradingDay();
    return {
      date: lastTradingDay.toISOString().split('T')[0],
      dateFormatted: lastTradingDay.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
      daysAgo: Math.floor((new Date() - lastTradingDay) / (1000 * 60 * 60 * 24)),
    };
  }

  /**
   * Get next trading day info for upcoming data
   */
  getNextTradingDayInfo() {
    const nextTradingDay = this.getNextTradingDay();
    return {
      date: nextTradingDay.toISOString().split('T')[0],
      dateFormatted: nextTradingDay.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
      daysAway: Math.floor((nextTradingDay - new Date()) / (1000 * 60 * 60 * 24)),
    };
  }
}

module.exports = new MarketHolidayManager();
