# ⚡ QUICK START GUIDE - LOCAL DEVELOPMENT

Get the stock intelligence platform running locally in 10 minutes!

---

## 📋 PREREQUISITES

- Node.js (v16+)
- npm or yarn
- Git
- MongoDB (optional - works without it initially)

---

## 1️⃣ INSTALL DEPENDENCIES

### **Backend Setup**
```bash
cd backend
npm install
```

This will install:
- Express.js (server framework)
- Socket.io (real-time WebSocket)
- MongoDB/Mongoose (database)
- Yahoo Finance API (stock data)
- Cheerio (web scraping)
- Bcrypt (password hashing)

### **Frontend Setup**
```bash
cd ../frontend
npm install
```

---

## 2️⃣ START THE SERVERS

### **Terminal 1: Start Backend**
```bash
cd backend
npm run dev
```

**Expected Output:**
```
✅ Indian Stock Scraper Server is running on port 5000
📡 WebSocket ready for real-time streaming
💼 Paper Trading API active
📊 Analytics Engine ready
```

### **Terminal 2: Start Frontend**
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
Local:   http://127.0.0.1:5173/
```

---

## 3️⃣ VERIFY EVERYTHING WORKS

### **Check Backend Health**
```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-05-26T10:30:00.000Z"
}
```

### **Check Current Features**
```bash
# Get market data
curl http://localhost:5000/api/market

# Get recommendations
curl -X POST http://localhost:5000/api/recommendations/smart \
  -H "Content-Type: application/json" \
  -d '{"tickers":["RELIANCE.NS","TCS.NS","INFY.NS"]}'

# Get analytics for a stock
curl http://localhost:5000/api/analytics/streaks/RELIANCE.NS
```

### **Open Frontend**
- Navigate to http://127.0.0.1:5173/
- You should see the market data page

---

## 🧪 TEST EACH FEATURE

### **Feature 1: Real-Time Streaming** 
**Status**: ✅ Ready

Test with browser console:
```javascript
const socket = io('http://localhost:5000');
socket.emit('subscribe', 'RELIANCE.NS');
socket.on('price-update', (data) => {
  console.log('Price Update:', data);
});
```

**What to expect**: Price updates every 5 seconds

---

### **Feature 2: Paper Trading**
**Status**: ✅ Ready

**Test Endpoints**:
```bash
# Create portfolio for user
curl -X POST http://localhost:5000/api/portfolio/create \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","username":"Demo User"}'

# Buy stock
curl -X POST http://localhost:5000/api/portfolio/buy \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "ticker":"RELIANCE.NS",
    "quantity":10,
    "currentPrice":2920
  }'

# Get portfolio
curl http://localhost:5000/api/portfolio/user123

# Get portfolio stats
curl http://localhost:5000/api/portfolio/user123/stats

# Get trade history
curl http://localhost:5000/api/portfolio/user123/trades
```

**Expected Outputs**:
- Portfolio created with ₹100,000 cash
- Buy operation successful
- Portfolio updated with position
- Stats show trade count and win rate

---

### **Feature 3: Analytics**
**Status**: ✅ Ready

**Test Endpoints**:
```bash
# Get consecutive streaks
curl http://localhost:5000/api/analytics/streaks/RELIANCE.NS

# Get most active stocks
curl -X POST http://localhost:5000/api/analytics/most-active \
  -H "Content-Type: application/json" \
  -d '{"tickers":["RELIANCE.NS","TCS.NS","INFY.NS"],"timeframe":"1d"}'

# Get why analysis
curl http://localhost:5000/api/analytics/why-analysis/RELIANCE.NS

# Get RSI
curl http://localhost:5000/api/analytics/rsi/RELIANCE.NS

# Generate avoid list
curl -X POST http://localhost:5000/api/analytics/avoid-list \
  -H "Content-Type: application/json" \
  -d '{"stocks":[...]}'
```

**Expected**: JSON with analysis data

---

### **Feature 4: Smart Recommendations**
**Status**: ✅ Ready

**Test Endpoint**:
```bash
curl -X POST http://localhost:5000/api/recommendations/smart \
  -H "Content-Type: application/json" \
  -d '{
    "tickers":["RELIANCE.NS","TCS.NS","INFY.NS","HDFCBANK.NS"],
    "avoidList":[]
  }'
```

**Expected Output**: Array of top 10 scored recommendations with:
- Score (0-100)
- Recommendation (BUY/STRONG BUY/HOLD/AVOID)
- Target price & stop loss
- Reasoning with 3+ factors

---

## 📊 SAMPLE API RESPONSES

### **Paper Trading Buy - Success**
```json
{
  "success": true,
  "portfolio": {
    "userId": "user123",
    "cash": 70800,
    "positions": [
      {
        "ticker": "RELIANCE.NS",
        "quantity": 10,
        "avgPrice": 2920,
        "currentPrice": 2920,
        "gainLoss": 0,
        "gainLossPercent": 0
      }
    ],
    "totalValue": 99800,
    "totalGain": 0,
    "totalGainPercent": 0,
    "totalInvested": 29200
  },
  "trade": {
    "userId": "user123",
    "ticker": "RELIANCE.NS",
    "type": "BUY",
    "quantity": 10,
    "price": 2920,
    "totalAmount": 29200,
    "timestamp": "2026-05-26T10:30:00.000Z"
  }
}
```

### **Streaks Response**
```json
{
  "success": true,
  "streaks": {
    "currentGainStreak": 3,
    "currentLossStreak": 0,
    "maxGainStreak": 5,
    "maxLossStreak": 4,
    "currentStreak": "gain",
    "lastUpdate": "2026-05-26T10:30:00.000Z"
  }
}
```

### **Most Active Stocks**
```json
{
  "success": true,
  "active": [
    {
      "ticker": "TATAMOTORS.NS",
      "name": "Tata Motors Limited",
      "price": 955.30,
      "change": 48.45,
      "changePercent": 5.82,
      "volume": 12400000,
      "volumeInMillion": 12.4,
      "activityScore": 86.2,
      "dayHigh": 965.50,
      "dayLow": 925.30
    }
  ]
}
```

---

## 🔧 COMMON ISSUES & FIXES

### **Issue: "Cannot find module 'socket.io'"**
```bash
Solution: npm install socket.io --save
```

### **Issue: Backend crashes on startup**
```bash
Solution: Check if port 5000 is already in use
# Kill the process:
# On Windows: taskkill /F /IM node.exe
# On Mac/Linux: killall node
```

### **Issue: "CORS error" in browser**
```bash
Solution: Already configured in backend
- CORS is enabled in express
- Verify frontend is on http://localhost:5173
```

### **Issue: Yahoo Finance API rate limited**
```bash
Solution: Data will use mock/fallback
- Check logs for: "serving fallbacks"
- API limits reset after 1-2 hours
- Caching is enabled (5 minutes)
```

### **Issue: Price updates not showing**
```bash
Solution: Check WebSocket connection
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter for "WS"
4. Should see WebSocket connection established
```

---

## 📱 ACCESSING FEATURES

### **Current Market Data**
```
http://localhost:5173
```
Shows live market data, gainers/losers, recommendations

### **Paper Trading** (Once integrated)
```
http://localhost:5173/trading
```
Buy/Sell stocks, view portfolio, check P&L

### **Analytics** (Once integrated)
```
http://localhost:5173/analytics
```
View streaks, most active stocks, why analysis

### **Recommendations** (Once integrated)
```
http://localhost:5173/recommendations
```
View AI-scored recommendations

---

## 💾 DATABASE (Optional)

### **Using Without MongoDB**
- ✅ All API endpoints work
- ✅ Real-time data works
- ✅ Data persists in memory (resets on server restart)

### **With MongoDB Local**
```bash
# Install MongoDB Community Edition
# Then start it:
mongod

# Add to backend/.env:
MONGODB_URI=mongodb://localhost:27017/stock-tracker
```

---

## 🎯 WHAT'S WORKING RIGHT NOW

✅ **Real-time WebSocket streaming** - Get live price updates  
✅ **Paper trading backend** - Buy/sell with P&L tracking  
✅ **Portfolio statistics** - Win rate, ROI, total trades  
✅ **Streak calculations** - Consecutive gains/loss detection  
✅ **Most active stocks** - Ranked by activity score  
✅ **Why analysis** - Explains stock movements  
✅ **RSI calculation** - Technical indicator (0-100)  
✅ **Smart recommendations** - AI scoring (30-100)  
✅ **Price alerts** - Set buy/sell price triggers  
✅ **REST API** - All endpoints functional  

---

## 📚 NEXT STEPS

### **Immediate**
1. Run both servers (backend & frontend)
2. Test each endpoint with curl
3. Verify WebSocket connection
4. Review generated code

### **Short Term** (30 mins)
1. Integrate frontend pages into main App.jsx
2. Add navigation routes
3. Connect real-time updates to UI

### **Medium Term** (2-3 hours)
1. Add user authentication UI
2. Connect portfolio to real data
3. Test all features end-to-end

### **Before Deployment**
1. Full regression testing
2. Performance testing
3. Security review
4. Database migration

---

## 📞 DEBUG MODE

Enable debug logging in backend:

**Add to backend/index.js before routes:**
```javascript
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Body:', req.body);
  next();
});
```

---

## ✨ TIP: POSTMAN COLLECTION

Import this into Postman to test all endpoints:

```json
{
  "info": { "name": "Stock Intelligence API" },
  "item": [
    {
      "name": "Create Portfolio",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/api/portfolio/create",
        "body": { "userId": "user123", "username": "Demo" }
      }
    },
    {
      "name": "Buy Stock",
      "request": {
        "method": "POST",
        "url": "http://localhost:5000/api/portfolio/buy",
        "body": { "userId": "user123", "ticker": "RELIANCE.NS", "quantity": 10, "currentPrice": 2920 }
      }
    }
  ]
}
```

---

**You're All Set! 🚀**

Run the servers and start testing!

Questions? Check the DEPLOYMENT_GUIDE.md or DEVELOPMENT_CHECKLIST.md
