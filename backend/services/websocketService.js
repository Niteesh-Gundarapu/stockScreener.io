const { getYahooFinance } = require('../utils/yahooClient');

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.priceCache = new Map();
    this.subscriptions = new Map(); // Map of ticker -> Set of socket IDs
  }

  setupConnections() {
    this.io.on('connection', (socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);

      socket.on('subscribe', (ticker) => {
        this._subscribeTicker(socket, ticker);
      });

      socket.on('unsubscribe', (ticker) => {
        this._unsubscribeTicker(socket, ticker);
      });

      socket.on('disconnect', () => {
        this._handleDisconnect(socket);
        console.log(`[WS] Client disconnected: ${socket.id}`);
      });

      socket.on('get-price', async (ticker, callback) => {
        const price = await this.getLatestPrice(ticker);
        if (callback) callback(price);
      });

      socket.on('get-watchlist', async (callback) => {
        // Will be populated from database
        if (callback) callback([]);
      });
    });
  }

  _subscribeTicker(socket, ticker) {
    if (!this.subscriptions.has(ticker)) {
      this.subscriptions.set(ticker, new Set());
      this._startPriceStream(ticker);
    }
    this.subscriptions.get(ticker).add(socket.id);
    console.log(`[WS] Socket ${socket.id} subscribed to ${ticker}`);
    
    // Send cached price immediately
    if (this.priceCache.has(ticker)) {
      socket.emit('price-update', this.priceCache.get(ticker));
    }
  }

  _unsubscribeTicker(socket, ticker) {
    if (this.subscriptions.has(ticker)) {
      this.subscriptions.get(ticker).delete(socket.id);
      if (this.subscriptions.get(ticker).size === 0) {
        this.subscriptions.delete(ticker);
      }
    }
    console.log(`[WS] Socket ${socket.id} unsubscribed from ${ticker}`);
  }

  _handleDisconnect(socket) {
    for (const [ticker, sockets] of this.subscriptions.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.subscriptions.delete(ticker);
      }
    }
  }

  _startPriceStream(ticker) {
    console.log(`[WS] Starting price stream for ${ticker}`);
    
    // Update prices every 5 seconds
    setInterval(async () => {
      if (!this.subscriptions.has(ticker)) return;

      try {
        const price = await this.getLatestPrice(ticker);
        this.priceCache.set(ticker, price);
        
        // Broadcast to all subscribed clients
        const socketIds = Array.from(this.subscriptions.get(ticker) || []);
        socketIds.forEach(socketId => {
          this.io.to(socketId).emit('price-update', price);
        });
      } catch (error) {
        console.error(`[WS] Error fetching price for ${ticker}:`, error.message);
      }
    }, 5000);
  }

  async getLatestPrice(ticker) {
    try {
      const yahooFinance = await getYahooFinance();
    const quote = await yahooFinance.quote(ticker);
      return {
        ticker,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        timestamp: new Date().toISOString(),
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        open: quote.regularMarketOpen
      };
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error.message);
      return null;
    }
  }

  broadcastMarketUpdate(data) {
    this.io.emit('market-update', data);
  }
}

module.exports = WebSocketService;
