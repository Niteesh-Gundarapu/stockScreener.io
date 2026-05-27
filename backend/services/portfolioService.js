const Portfolio = require('../models/Portfolio');
const Trade = require('../models/Trade');
const PriceAlert = require('../models/PriceAlert');

class PortfolioService {
  constructor() {
    this.initialBalance = 100000; // ₹100,000 virtual currency
  }

  async createPortfolio(userId, username) {
    try {
      const portfolio = new Portfolio({
        userId,
        username,
        cash: this.initialBalance,
        positions: [],
        totalValue: this.initialBalance,
        totalGain: 0,
        totalGainPercent: 0,
        totalInvested: 0
      });
      await portfolio.save();
      return portfolio;
    } catch (error) {
      throw new Error(`Failed to create portfolio: ${error.message}`);
    }
  }

  async getPortfolio(userId) {
    try {
      const portfolio = await Portfolio.findOne({ userId }).populate('positions');
      return portfolio;
    } catch (error) {
      throw new Error(`Failed to fetch portfolio: ${error.message}`);
    }
  }

  async buyStock(userId, ticker, quantity, currentPrice) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) throw new Error('Portfolio not found');

      const totalCost = quantity * currentPrice;
      if (portfolio.cash < totalCost) {
        throw new Error('Insufficient cash balance');
      }

      // Create trade record
      const trade = new Trade({
        userId,
        ticker,
        type: 'BUY',
        quantity,
        price: currentPrice,
        totalAmount: totalCost,
        timestamp: new Date()
      });
      await trade.save();

      // Update portfolio
      portfolio.cash -= totalCost;
      portfolio.totalInvested += totalCost;

      // Add or update position
      const existingPosition = portfolio.positions.find(p => p.ticker === ticker);
      if (existingPosition) {
        const newQuantity = existingPosition.quantity + quantity;
        const newAvgPrice = (existingPosition.avgPrice * existingPosition.quantity + currentPrice * quantity) / newQuantity;
        existingPosition.quantity = newQuantity;
        existingPosition.avgPrice = newAvgPrice;
      } else {
        portfolio.positions.push({
          ticker,
          quantity,
          avgPrice: currentPrice,
          currentPrice,
          gainLoss: 0,
          gainLossPercent: 0
        });
      }

      await portfolio.save();
      return { success: true, portfolio, trade };
    } catch (error) {
      throw new Error(`Buy operation failed: ${error.message}`);
    }
  }

  async sellStock(userId, ticker, quantity, currentPrice) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) throw new Error('Portfolio not found');

      const position = portfolio.positions.find(p => p.ticker === ticker);
      if (!position || position.quantity < quantity) {
        throw new Error('Insufficient stock quantity');
      }

      const totalProceeds = quantity * currentPrice;

      // Create trade record
      const trade = new Trade({
        userId,
        ticker,
        type: 'SELL',
        quantity,
        price: currentPrice,
        totalAmount: totalProceeds,
        timestamp: new Date()
      });
      await trade.save();

      // Update portfolio
      portfolio.cash += totalProceeds;

      // Update position
      position.quantity -= quantity;
      if (position.quantity === 0) {
        portfolio.positions = portfolio.positions.filter(p => p.ticker !== ticker);
      }

      await portfolio.save();
      return { success: true, portfolio, trade };
    } catch (error) {
      throw new Error(`Sell operation failed: ${error.message}`);
    }
  }

  async updatePortfolioValues(userId, currentPrices) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) return null;

      let totalPortfolioValue = portfolio.cash;
      let totalGain = 0;

      portfolio.positions.forEach(position => {
        const currentPrice = currentPrices[position.ticker] || position.currentPrice;
        const positionValue = position.quantity * currentPrice;
        const costBasis = position.quantity * position.avgPrice;
        const positionGain = positionValue - costBasis;

        position.currentPrice = currentPrice;
        position.gainLoss = positionGain;
        position.gainLossPercent = (positionGain / costBasis) * 100 || 0;

        totalPortfolioValue += positionValue;
        totalGain += positionGain;
      });

      portfolio.totalValue = totalPortfolioValue;
      portfolio.totalGain = totalGain;
      portfolio.totalGainPercent = (totalGain / this.initialBalance) * 100 || 0;
      portfolio.lastUpdated = new Date();

      await portfolio.save();
      return portfolio;
    } catch (error) {
      throw new Error(`Failed to update portfolio values: ${error.message}`);
    }
  }

  async getTradeHistory(userId, limit = 50) {
    try {
      const trades = await Trade.find({ userId }).sort({ timestamp: -1 }).limit(limit);
      return trades;
    } catch (error) {
      throw new Error(`Failed to fetch trade history: ${error.message}`);
    }
  }

  async getPortfolioStats(userId) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      const trades = await Trade.find({ userId });

      const totalTrades = trades.length;
      const buyTrades = trades.filter(t => t.type === 'BUY');
      const sellTrades = trades.filter(t => t.type === 'SELL');

      const winningTrades = sellTrades.filter(sell => {
        const buyPrice = buyTrades.find(b => b.ticker === sell.ticker)?.price || 0;
        return sell.price > buyPrice;
      }).length;

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : 0;

      return {
        totalTrades,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        winningTrades,
        winRate,
        totalInvested: portfolio.totalInvested,
        currentValue: portfolio.totalValue,
        totalGain: portfolio.totalGain,
        roi: ((portfolio.totalGain / this.initialBalance) * 100).toFixed(2)
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio stats: ${error.message}`);
    }
  }

  async createPriceAlert(userId, ticker, targetPrice, alertType = 'ABOVE') {
    try {
      const alert = new PriceAlert({
        userId,
        ticker,
        targetPrice,
        alertType,
        createdAt: new Date()
      });
      await alert.save();
      return alert;
    } catch (error) {
      throw new Error(`Failed to create price alert: ${error.message}`);
    }
  }

  async getPriceAlerts(userId) {
    try {
      const alerts = await PriceAlert.find({ userId, isActive: true });
      return alerts;
    } catch (error) {
      throw new Error(`Failed to fetch price alerts: ${error.message}`);
    }
  }

  async checkPriceAlerts(ticker, currentPrice) {
    try {
      const alerts = await PriceAlert.find({ ticker, isActive: true });
      const triggeredAlerts = [];

      for (const alert of alerts) {
        let shouldTrigger = false;

        if (alert.alertType === 'ABOVE' && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.alertType === 'BELOW' && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          alert.isActive = false;
          alert.triggeredAt = new Date();
          await alert.save();
          triggeredAlerts.push(alert);
        }
      }

      return triggeredAlerts;
    } catch (error) {
      console.error('Error checking price alerts:', error.message);
      return [];
    }
  }
}

module.exports = PortfolioService;
