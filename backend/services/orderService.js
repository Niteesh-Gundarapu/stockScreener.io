// backend/services/orderService.js
// Handles order placement and execution logic (simple engine)

const pino = require('pino');
const { prisma } = require('../db/client');
const marketDataService = require('./marketDataService');
const portfolioService = require('./portfolioService');

const logger = pino();

class OrderService {
  constructor() {}

  /**
   * Place a new order. For MARKET orders execute immediately.
   * Supports simple leverage: leverage param (1-5)
   */
  async placeOrder({ userId, portfolioId, ticker, side, type, quantity, limitPrice = null, stopPrice = null, trailingPct = null, leverage = 1, isIntraday = false, linkedOrderId = null }) {
    try {
      // Basic validation
      quantity = parseInt(quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity');
      if (![1,2,3,4,5].includes(Number(leverage))) throw new Error('Invalid leverage');

      // Create order record (PENDING or FILLED)
      const order = await prisma.order.create({
        data: {
          portfolioId,
          userId,
          ticker,
          side,
          type,
          quantity,
          limitPrice: limitPrice ? Number(limitPrice) : null,
          stopPrice: stopPrice ? Number(stopPrice) : null,
          trailingPct: trailingPct ? Number(trailingPct) : null,
          linkedOrderId,
        },
      });

      logger.info({ orderId: order.id, type, ticker, side }, 'Order placed');

      // MARKET order: execute immediately
      if (type === 'MARKET') {
        return await this._executeMarketOrder(order.id, leverage, isIntraday);
      }

      // For LIMIT/STOP/TRA trailing: leave PENDING and worker will process
      return { success: true, order };
    } catch (error) {
      logger.error({ error: error.message }, 'Place order failed');
      throw error;
    }
  }

  /**
   * Execute market order immediately (atomic)
   */
  async _executeMarketOrder(orderId, leverage = 1, isIntraday = false) {
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.status !== 'PENDING') throw new Error('Order not pending');

      // Get latest market price
      const quote = await marketDataService.getLatestPrice(order.ticker);
      if (!quote) throw new Error('Price unavailable');
      const price = quote.price;

      // For BUY, check margin/cash
      if (order.side === 'BUY') {
        const totalCost = price * order.quantity;
        const marginRequired = totalCost * (1 / Number(leverage));

        // Update DB in transaction: create trade, create/update position, update portfolio balances
        const result = await prisma.$transaction(async (tx) => {
          // Fetch portfolio
          const portfolio = await tx.portfolio.findUnique({ where: { id: order.portfolioId } });
          if (!portfolio) throw new Error('Portfolio not found');

          if (Number(portfolio.cashBalance) < marginRequired) throw new Error('Insufficient cash for margin');

          // Create trade
          const trade = await tx.trade.create({
            data: {
              portfolioId: portfolio.id,
              userId: order.userId,
              ticker: order.ticker,
              tradeType: 'BUY',
              quantity: order.quantity,
              price,
              totalAmount: totalCost,
              status: 'FILLED',
              executedAt: new Date(),
            },
          });

          // Update or create position
          const existingPosition = await tx.position.findUnique({
            where: {
              portfolioId_ticker: {
                portfolioId: portfolio.id,
                ticker: order.ticker,
              },
            },
          });

          let position;
          if (existingPosition) {
            const newQuantity = existingPosition.quantity + order.quantity;
            const newAvgPrice = (Number(existingPosition.avgPrice) * existingPosition.quantity + price * order.quantity) / newQuantity;
            position = await tx.position.update({ where: { id: existingPosition.id }, data: { quantity: newQuantity, avgPrice: newAvgPrice, currentPrice: price, leverage, marginUsed: Number(existingPosition.marginUsed) + (marginRequired), marginRequired: Number(existingPosition.marginRequired) + (marginRequired), isIntraday } });
          } else {
            position = await tx.position.create({ data: { portfolioId: portfolio.id, ticker: order.ticker, quantity: order.quantity, avgPrice: price, currentPrice: price, leverage, marginUsed: marginRequired, marginRequired, isIntraday, buyDate: new Date() } });
          }

          // Update portfolio balances
          const updatedPortfolio = await tx.portfolio.update({ where: { id: portfolio.id }, data: { cashBalance: Number(portfolio.cashBalance) - marginRequired, totalInvested: { increment: totalCost }, updatedAt: new Date() } });

          // Mark order as FILLED
          const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: 'FILLED', executedAt: new Date(), filledQuantity: order.quantity } });

          return { trade, position, portfolio: updatedPortfolio, order: updatedOrder };
        });

        logger.info({ orderId, ticker: order.ticker }, 'Market BUY executed');
        return { success: true, result };
      }

      // For SELL, ensure position exists and has quantity
      if (order.side === 'SELL') {
        const result = await prisma.$transaction(async (tx) => {
          const portfolio = await tx.portfolio.findUnique({ where: { id: order.portfolioId } });
          if (!portfolio) throw new Error('Portfolio not found');

          const position = await tx.position.findUnique({ where: { portfolioId_ticker: { portfolioId: portfolio.id, ticker: order.ticker } } });
          if (!position || position.quantity < order.quantity) throw new Error('Insufficient position quantity');

          const totalProceeds = price * order.quantity;
          const costBasis = Number(position.avgPrice) * order.quantity;
          const gain = totalProceeds - costBasis;

          const trade = await tx.trade.create({ data: { portfolioId: portfolio.id, userId: order.userId, ticker: order.ticker, tradeType: 'SELL', quantity: order.quantity, price, totalAmount: totalProceeds, status: 'FILLED', executedAt: new Date() } });

          let updatedPosition;
          if (position.quantity === order.quantity) {
            await tx.position.delete({ where: { id: position.id } });
            updatedPosition = null;
          } else {
            updatedPosition = await tx.position.update({ where: { id: position.id }, data: { quantity: { decrement: order.quantity }, updatedAt: new Date() } });
          }

          const updatedPortfolio = await tx.portfolio.update({ where: { id: portfolio.id }, data: { cashBalance: Number(portfolio.cashBalance) + totalProceeds, totalInvested: { decrement: costBasis }, totalGainLoss: { increment: gain }, updatedAt: new Date() } });

          const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: 'FILLED', executedAt: new Date(), filledQuantity: order.quantity } });

          return { trade, position: updatedPosition, portfolio: updatedPortfolio, order: updatedOrder, gain };
        });

        logger.info({ orderId, ticker: order.ticker }, 'Market SELL executed');
        return { success: true, result };
      }

      throw new Error('Unsupported order side');
    } catch (error) {
      logger.error({ error: error.message, orderId }, 'Execute market order failed');
      // Mark order as CANCELLED on failure
      try { await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', updatedAt: new Date() } }); } catch (e) {}
      throw error;
    }
  }

  /**
   * Process pending orders: LIMIT, STOP_LOSS, TRAILING_STOP, OCO
   * Called by background worker periodically during market hours
   */
  async processPendingOrders() {
    try {
      const pendingOrders = await prisma.order.findMany({ where: { status: 'PENDING' } });
      if (!pendingOrders || pendingOrders.length === 0) return [];

      const tickers = Array.from(new Set(pendingOrders.map(o => o.ticker)));
      const prices = await marketDataService.getPricesBatch(tickers);
      const priceMap = new Map(prices.map(p => [p.ticker, p]));

      const executed = [];

      for (const order of pendingOrders) {
        const market = priceMap.get(order.ticker);
        if (!market) continue;
        const price = market.price;

        // LIMIT BUY: execute when market.price <= limitPrice
        if (order.type === 'LIMIT' && order.side === 'BUY' && order.limitPrice && price <= Number(order.limitPrice)) {
          await this._executeMarketOrder(order.id, 1, false);
          executed.push(order.id);
          continue;
        }

        // LIMIT SELL: execute when market.price >= limitPrice
        if (order.type === 'LIMIT' && order.side === 'SELL' && order.limitPrice && price >= Number(order.limitPrice)) {
          await this._executeMarketOrder(order.id, 1, false);
          executed.push(order.id);
          continue;
        }

        // STOP_LOSS: SELL when price <= stopPrice
        if (order.type === 'STOP_LOSS' && order.side === 'SELL' && order.stopPrice && price <= Number(order.stopPrice)) {
          await this._executeMarketOrder(order.id, 1, false);
          executed.push(order.id);
          continue;
        }

        // TRAILING_STOP: adjust stop based on new highs (simple implementation)
        if (order.type === 'TRAILING_STOP' && order.side === 'SELL' && order.trailingPct) {
          // Calculate trigger price = lastHigh * (1 - trailingPct)
          // For simplicity, use current price as last high placeholder
          const trigger = price * (1 - Number(order.trailingPct) / 100);
          if (price <= trigger) {
            await this._executeMarketOrder(order.id, 1, false);
            executed.push(order.id);
            continue;
          }
        }

        // OCO handling: if linkedOrderId exists and its sibling executed, cancel this one
        if (order.linkedOrderId) {
          const sibling = await prisma.order.findUnique({ where: { id: order.linkedOrderId } });
          if (sibling && sibling.status === 'FILLED') {
            await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', updatedAt: new Date() } });
          }
        }
      }

      return executed;
    } catch (error) {
      logger.error({ error: error.message }, 'processPendingOrders failed');
      throw error;
    }
  }
}

module.exports = new OrderService();
