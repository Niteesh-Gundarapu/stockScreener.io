// Refactored: Single master loop + fan-out pattern
// Prevents memory leaks and rate limit exhaustion
// Market hours aware (9:15 AM - 3:30 PM IST only)

const pino = require('pino');
const marketDataService = require('./marketDataService');
const { isMarketOpen, getMinutesUntilClose } = require('../utils/marketHours');

const logger = pino();

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.subscriptions = new Map(); // ticker -> Set<socketId>
    this.masterLoopInterval = null;
    this.updateInterval = process.env.WS_UPDATE_INTERVAL_MS || 5000;
    this.activeSockets = new Set();
  }

  /**
   * Initialize WebSocket event handlers
   */
  setupConnections() {
    this.io.on('connection', (socket) => {
      this.activeSockets.add(socket.id);
      logger.info({ socketId: socket.id, totalConnections: this.activeSockets.size }, '[WS] Client connected');

      // Client subscribes to ticker
      socket.on('subscribe', (ticker) => {
        this._subscribeTicker(socket, ticker);
      });

      // Client unsubscribes from ticker
      socket.on('unsubscribe', (ticker) => {
        this._unsubscribeTicker(socket, ticker);
      });

      // Client requests current price
      socket.on('get-price', async (ticker, callback) => {
        try {
          const price = await marketDataService.getLatestPrice(ticker);
          if (callback) callback({ success: true, data: price });
        } catch (error) {
          if (callback) callback({ success: false, error: error.message });
        }
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        this._handleDisconnect(socket);
        this.activeSockets.delete(socket.id);
        logger.info({ socketId: socket.id, totalConnections: this.activeSockets.size }, '[WS] Client disconnected');

        // Stop master loop if no more subscriptions
        if (this.subscriptions.size === 0 && this.masterLoopInterval) {
          this._stopMasterLoop();
        }
      });
    });

    // Start master loop after setup
    this._startMasterLoop();
  }

  /**
   * Subscribe socket to a ticker
   */
  _subscribeTicker(socket, ticker) {
    if (!this.subscriptions.has(ticker)) {
      this.subscriptions.set(ticker, new Set());
      logger.info({ ticker }, '[WS] New ticker subscription');
    }

    this.subscriptions.get(ticker).add(socket.id);
    logger.info({ ticker, socketId: socket.id, subscribers: this.subscriptions.get(ticker).size }, '[WS] Socket subscribed');
  }

  /**
   * Unsubscribe socket from ticker
   */
  _unsubscribeTicker(socket, ticker) {
    if (this.subscriptions.has(ticker)) {
      this.subscriptions.get(ticker).delete(socket.id);

      // Clean up empty ticker subscriptions
      if (this.subscriptions.get(ticker).size === 0) {
        this.subscriptions.delete(ticker);
        logger.info({ ticker }, '[WS] Ticker unsubscribed (no more subscribers)');
      }
    }
  }

  /**
   * Handle socket disconnection - clean up all subscriptions
   */
  _handleDisconnect(socket) {
    for (const [ticker, sockets] of this.subscriptions.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.subscriptions.delete(ticker);
      }
    }
  }

  /**
   * SINGLE MASTER LOOP - Fetches all prices once, broadcasts to all subscribers
   * This is the KEY improvement: N subscribers don't create N API calls
   * MARKET HOURS AWARE: Only updates during 9:15 AM - 3:30 PM IST
   */
  _startMasterLoop() {
    if (this.masterLoopInterval) return; // Already running

    logger.info('[WS] Starting master loop');

    this.masterLoopInterval = setInterval(async () => {
      // Skip update if market is closed (after 3:30 PM IST)
      if (!isMarketOpen()) {
        logger.debug('[WS] Market closed, skipping price update');
        return;
      }

      if (this.subscriptions.size === 0) {
        // No subscribers, skip this iteration
        return;
      }

      try {
        // Fetch all subscribed tickers in a SINGLE batch call
        const tickers = Array.from(this.subscriptions.keys());
        const priceData = await marketDataService.getPricesBatch(tickers);

        // Broadcast to subscribers (fan-out)
        priceData.forEach((priceUpdate) => {
          if (this.subscriptions.has(priceUpdate.ticker)) {
            const subscribers = this.subscriptions.get(priceUpdate.ticker);
            subscribers.forEach((socketId) => {
              this.io.to(socketId).emit('price-update', {
                ticker: priceUpdate.ticker,
                price: priceUpdate.price,
                change: priceUpdate.change,
                changePercent: priceUpdate.changePercent,
                high: priceUpdate.high,
                low: priceUpdate.low,
                volume: priceUpdate.volume,
                source: priceUpdate.source,
                timestamp: priceUpdate.timestamp,
              });
            });
          }
        });

        logger.debug({ tickers: tickers.length, subscribers: this.activeSockets.size }, '[WS] Broadcast complete');
      } catch (error) {
        logger.error({ error: error.message }, '[WS] Master loop error');
      }
    }, this.updateInterval);
  }

  /**
   * Stop the master loop (when no more subscribers)
   * IMPORTANT: Prevents memory leaks by cleaning up the interval
   */
  _stopMasterLoop() {
    if (this.masterLoopInterval) {
      clearInterval(this.masterLoopInterval);
      this.masterLoopInterval = null;
      logger.info('[WS] Master loop stopped and cleaned up');
    }
  }

  /**
   * Broadcast market-wide updates (gainers/losers, market status)
   */
  broadcastMarketUpdate(data) {
    this.io.emit('market-update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current connection stats (for monitoring)
   */
  getStats() {
    return {
      activeConnections: this.activeSockets.size,
      subscribedTickers: this.subscriptions.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0),
      masterLoopRunning: this.masterLoopInterval !== null,
    };
  }
}

module.exports = WebSocketService;
