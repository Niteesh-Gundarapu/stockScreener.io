// backend/services/portfolioService.js
// Portfolio management with PostgreSQL/Prisma
// Implements batch processing and ACID transactions

const pino = require('pino');
const { prisma } = require('../db/client');
const marketDataService = require('./marketDataService');

const logger = pino();

class PortfolioService {
  constructor() {
    this.initialBalance = 100000; // ₹100,000 virtual trading
  }

  /**
   * Get portfolio with all positions
   */
  async getPortfolio(userId) {
    try {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId },
        include: {
          positions: true,
        },
      });

      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      return portfolio;
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Failed to get portfolio');
      throw error;
    }
  }

  /**
   * Buy stock (with ACID transaction)
   * Ensures: trade recorded + portfolio updated atomically
   */
  async buyStock(userId, ticker, quantity, currentPrice) {
    try {
      const totalCost = quantity * currentPrice;

      // Use Prisma transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
        // 1. Get portfolio
        const portfolio = await tx.portfolio.findUnique({
          where: { userId },
        });

        if (!portfolio) throw new Error('Portfolio not found');
        if (portfolio.cashBalance < totalCost) {
          throw new Error('Insufficient cash balance');
        }

        // 2. Create trade (immutable record)
        const trade = await tx.trade.create({
          data: {
            portfolioId: portfolio.id,
            userId,
            ticker,
            tradeType: 'BUY',
            quantity,
            price: currentPrice,
            totalAmount: totalCost,
            status: 'FILLED',
            executedAt: new Date(),
          },
        });

        // 3. Update or create position
        const existingPosition = await tx.position.findUnique({
          where: {
            portfolioId_ticker: {
              portfolioId: portfolio.id,
              ticker,
            },
          },
        });

        let position;
        if (existingPosition) {
          // Update average price for existing position
          const newQuantity = existingPosition.quantity + quantity;
          const newAvgPrice =
            (existingPosition.avgPrice * existingPosition.quantity + currentPrice * quantity) /
            newQuantity;

          position = await tx.position.update({
            where: { id: existingPosition.id },
            data: {
              quantity: newQuantity,
              avgPrice: newAvgPrice,
              currentPrice,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new position
          position = await tx.position.create({
            data: {
              portfolioId: portfolio.id,
              ticker,
              quantity,
              avgPrice: currentPrice,
              currentPrice,
              buyDate: new Date(),
            },
          });
        }

        // 4. Update portfolio balances
        const updatedPortfolio = await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: { decrement: totalCost },
            totalInvested: { increment: totalCost },
            updatedAt: new Date(),
          },
          include: { positions: true },
        });

        return { trade, position, portfolio: updatedPortfolio };
      });

      logger.info(
        { userId, ticker, quantity, price: currentPrice },
        'Buy executed successfully'
      );
      return { success: true, ...result };
    } catch (error) {
      logger.error({ userId, ticker, error: error.message }, 'Buy execution failed');
      throw error;
    }
  }

  /**
   * Sell stock (with ACID transaction)
   */
  async sellStock(userId, ticker, quantity, currentPrice) {
    try {
      const totalProceeds = quantity * currentPrice;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Get portfolio
        const portfolio = await tx.portfolio.findUnique({
          where: { userId },
        });

        if (!portfolio) throw new Error('Portfolio not found');

        // 2. Check position
        const position = await tx.position.findUnique({
          where: {
            portfolioId_ticker: {
              portfolioId: portfolio.id,
              ticker,
            },
          },
        });

        if (!position || position.quantity < quantity) {
          throw new Error('Insufficient stock quantity');
        }

        // 3. Create trade
        const costBasis = position.avgPrice * quantity;
        const gain = totalProceeds - costBasis;

        const trade = await tx.trade.create({
          data: {
            portfolioId: portfolio.id,
            userId,
            ticker,
            tradeType: 'SELL',
            quantity,
            price: currentPrice,
            totalAmount: totalProceeds,
            status: 'FILLED',
            executedAt: new Date(),
          },
        });

        // 4. Update position or delete if fully sold
        let updatedPosition;
        if (position.quantity === quantity) {
          // Fully sold - delete position
          await tx.position.delete({
            where: { id: position.id },
          });
          updatedPosition = null;
        } else {
          // Partial sell - update position
          updatedPosition = await tx.position.update({
            where: { id: position.id },
            data: {
              quantity: { decrement: quantity },
              updatedAt: new Date(),
            },
          });
        }

        // 5. Update portfolio
        const updatedPortfolio = await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            cashBalance: { increment: totalProceeds },
            totalInvested: { decrement: costBasis },
            totalGainLoss: { increment: gain },
            updatedAt: new Date(),
          },
          include: { positions: true },
        });

        return { trade, position: updatedPosition, portfolio: updatedPortfolio, gain };
      });

      logger.info(
        { userId, ticker, quantity, price: currentPrice, gain: result.gain },
        'Sell executed successfully'
      );
      return { success: true, ...result };
    } catch (error) {
      logger.error({ userId, ticker, error: error.message }, 'Sell execution failed');
      throw error;
    }
  }

  /**
   * BATCH UPDATE: Refresh all user portfolios with latest prices
   * Optimized for 1,000+ concurrent users
   * Fetches all prices once, updates all positions atomically
   */
  async updatePortfolioValuesBatch(userIds = null) {
    try {
      // Get all active portfolios
      const portfolios = userIds
        ? await prisma.portfolio.findMany({
            where: { userId: { in: userIds } },
            include: { positions: true },
          })
        : await prisma.portfolio.findMany({
            include: { positions: true },
          });

      if (portfolios.length === 0) {
        logger.info('No portfolios to update');
        return [];
      }

      // 1. Collect all unique tickers
      const allTickers = new Set();
      portfolios.forEach((p) => {
        p.positions.forEach((pos) => allTickers.add(pos.ticker));
      });

      if (allTickers.size === 0) {
        logger.info('No positions to update');
        return portfolios;
      }

      // 2. BATCH FETCH all prices at once (single API call)
      const tickers = Array.from(allTickers);
      logger.info({ tickersCount: tickers.length }, 'Batch fetching prices');
      const priceUpdates = await marketDataService.getPricesBatch(tickers);

      // Convert to map for O(1) lookup
      const priceMap = new Map();
      priceUpdates.forEach((p) => {
        priceMap.set(p.ticker, p);
      });

      // 3. BATCH UPDATE all positions
      const updatePromises = [];
      const updatedPortfolios = [];

      for (const portfolio of portfolios) {
        let totalPortfolioValue = Number(portfolio.cashBalance);
        let totalGainLoss = 0;

        const positionUpdates = [];

        for (const position of portfolio.positions) {
          const latestPrice = priceMap.get(position.ticker);
          if (!latestPrice) continue;

          const currentPrice = latestPrice.price;
          const positionValue = position.quantity * currentPrice;
          const costBasis = position.quantity * Number(position.avgPrice);
          const positionGain = positionValue - costBasis;
          const gainPercent = costBasis > 0 ? (positionGain / costBasis) * 100 : 0;

          positionUpdates.push({
            id: position.id,
            currentPrice,
            gainLoss: positionGain,
            gainLossPercent: gainPercent,
          });

          totalPortfolioValue += positionValue;
          totalGainLoss += positionGain;
        }

        // Update all positions for this portfolio
        if (positionUpdates.length > 0) {
          updatePromises.push(
            prisma.$transaction(
              positionUpdates.map((update) =>
                prisma.position.update({
                  where: { id: update.id },
                  data: {
                    currentPrice: update.currentPrice,
                    gainLoss: update.gainLoss,
                    gainLossPercent: update.gainLossPercent,
                  },
                })
              )
            )
          );
        }

        // Update portfolio totals
        const gainPercent =
          this.initialBalance > 0 ? (totalGainLoss / this.initialBalance) * 100 : 0;

        updatePromises.push(
          prisma.portfolio.update({
            where: { id: portfolio.id },
            data: {
              totalValue: totalPortfolioValue,
              totalGainLoss,
              totalGainLossPercent: gainPercent,
              updatedAt: new Date(),
            },
          })
        );
      }

      // Execute all updates in parallel
      const results = await Promise.all(updatePromises);
      logger.info(
        { portfolioCount: portfolios.length, updateCount: updatePromises.length },
        'Batch portfolio update complete'
      );

      return portfolios;
    } catch (error) {
      logger.error({ error: error.message }, 'Batch portfolio update failed');
      throw error;
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(userId, limit = 50) {
    try {
      const portfolio = await prisma.portfolio.findUnique({ where: { userId } });
      if (!portfolio) throw new Error('Portfolio not found');

      const trades = await prisma.trade.findMany({
        where: { portfolioId: portfolio.id },
        orderBy: { executedAt: 'desc' },
        take: limit,
      });

      return trades;
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Failed to get trade history');
      throw error;
    }
  }

  /**
   * Get portfolio statistics
   */
  async getPortfolioStats(userId) {
    try {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId },
        include: { positions: true },
      });

      if (!portfolio) throw new Error('Portfolio not found');

      const trades = await prisma.trade.findMany({
        where: { userId },
      });

      const totalTrades = trades.length;
      const buyTrades = trades.filter((t) => t.tradeType === 'BUY').length;
      const sellTrades = trades.filter((t) => t.tradeType === 'SELL').length;

      const roi = ((portfolio.totalGainLoss / this.initialBalance) * 100).toFixed(2);

      return {
        totalTrades,
        buyTrades,
        sellTrades,
        currentCash: portfolio.cashBalance,
        totalValue: portfolio.totalValue,
        totalInvested: portfolio.totalInvested,
        totalGainLoss: portfolio.totalGainLoss,
        roi,
        positionCount: portfolio.positions.length,
      };
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Failed to get portfolio stats');
      throw error;
    }
  }

  /**
   * Create price alert
   */
  async createPriceAlert(userId, ticker, targetPrice, alertType) {
    try {
      const alert = await prisma.priceAlert.create({
        data: {
          userId,
          ticker,
          targetPrice,
          alertType,
          isActive: true,
          createdAt: new Date(),
        },
      });

      logger.info({ userId, ticker, targetPrice }, 'Price alert created');
      return alert;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create price alert');
      throw error;
    }
  }

  /**
   * Get active price alerts
   */
  async getPriceAlerts(userId) {
    try {
      const alerts = await prisma.priceAlert.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      return alerts;
    } catch (error) {
      logger.error({ userId, error: error.message }, 'Failed to get price alerts');
      throw error;
    }
  }

  /**
   * Check and trigger price alerts (called by background worker)
   */
  async checkAndTriggerAlerts(ticker, currentPrice) {
    try {
      const alerts = await prisma.priceAlert.findMany({
        where: {
          ticker,
          isActive: true,
        },
      });

      const triggeredAlerts = [];

      for (const alert of alerts) {
        let shouldTrigger = false;

        if (alert.alertType === 'ABOVE' && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.alertType === 'BELOW' && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          // Deactivate alert
          await prisma.priceAlert.update({
            where: { id: alert.id },
            data: {
              isActive: false,
              triggeredAt: new Date(),
            },
          });

          triggeredAlerts.push(alert);
        }
      }

      if (triggeredAlerts.length > 0) {
        logger.info(
          { ticker, price: currentPrice, triggeredCount: triggeredAlerts.length },
          'Price alerts triggered'
        );
      }

      return triggeredAlerts;
    } catch (error) {
      logger.error({ ticker, error: error.message }, 'Failed to check price alerts');
      throw error;
    }
  }
}

module.exports = new PortfolioService();
