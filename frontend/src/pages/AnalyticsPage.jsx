import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function AnalyticsPage() {
  const [activeStocks, setActiveStocks] = useState([]);
  const [streaks, setStreaks] = useState({});
  const [avoidList, setAvoidList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('RELIANCE.NS');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch most active stocks
      const tickers = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS'];
      const activeRes = await fetch(`${API_BASE}/analytics/most-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, timeframe: '1d' })
      });

      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveStocks(data.active);
      }

      // Fetch streaks for each
      const streaksData = {};
      for (const ticker of tickers) {
        const streakRes = await fetch(`${API_BASE}/analytics/streaks/${ticker}`);
        if (streakRes.ok) {
          const data = await streakRes.json();
          streaksData[ticker] = data.streaks;
        }
      }
      setStreaks(streaksData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📊 Advanced Analytics</h1>
        <p className="text-gray-400">Market Streaks, Most Active & Why Analysis</p>
      </div>

      {/* Most Active Stocks */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp size={20} /> Most Active Stocks (Today)
        </h2>
        
        <div className="space-y-3">
          {activeStocks.map((stock, idx) => (
            <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 cursor-pointer" 
                 onClick={() => setSelectedTicker(stock.ticker)}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-lg">{stock.ticker}</div>
                  <div className="text-sm text-gray-400">{stock.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">₹{stock.price?.toFixed(2)}</div>
                  <div className={`font-bold ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Volume</div>
                  <div className="font-bold">{stock.volumeInMillion?.toFixed(1)}M</div>
                </div>
                <div>
                  <div className="text-gray-400">Day High/Low</div>
                  <div className="font-bold">₹{stock.dayHigh?.toFixed(2)} / ₹{stock.dayLow?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Activity Score</div>
                  <div className="font-bold text-blue-400">{stock.activityScore?.toFixed(1)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Consecutive Streaks */}
      <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target size={20} /> Consecutive Gain/Loss Streaks
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {Object.entries(streaks).map(([ticker, streak]) => (
            <div key={ticker} className={`rounded-lg p-4 ${
              streak.currentGainStreak > 0 ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'
            }`}>
              <div className="font-bold mb-2">{ticker}</div>
              <div className="space-y-1 text-sm">
                <div>Current Streak: <span className="font-bold">{streak.currentStreak}</span></div>
                <div>Gain Streak: <span className="font-bold text-green-400">{streak.currentGainStreak} days</span></div>
                <div>Loss Streak: <span className="font-bold text-red-400">{streak.currentLossStreak} days</span></div>
                <div>Max Gain: <span className="font-bold text-green-300">{streak.maxGainStreak} days</span></div>
                <div>Max Loss: <span className="font-bold text-red-300">{streak.maxLossStreak} days</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why Analysis */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle size={20} /> Why Is {selectedTicker} Active Today?
        </h2>
        
        <div className="space-y-3">
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500">
            <div className="font-bold">📈 Strong Upward Momentum</div>
            <p className="text-sm text-gray-300 mt-1">Stock moved +5.82% in a single day, indicating significant market sentiment shift</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
            <div className="font-bold">📊 Unusual Volume Activity</div>
            <p className="text-sm text-gray-300 mt-1">Trading volume is 125% above average, indicating strong investor interest</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="font-bold">🎯 Near 52-Week High</div>
            <p className="text-sm text-gray-300 mt-1">Stock is trading near its 52-week high (2% below), suggesting strong long-term momentum</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
            <div className="font-bold">📰 Active News Coverage</div>
            <p className="text-sm text-gray-300 mt-1">12 news articles available, indicating strong market attention</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
