import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Trash2, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function PaperTradingPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('portfolio');
  const [buyModal, setBuyModal] = useState(false);
  const [sellModal, setSellModal] = useState(false);
  const [buyForm, setBuyForm] = useState({ ticker: '', quantity: 1, price: 0 });
  const [loading, setLoading] = useState(false);

  const userId = localStorage.getItem('userId') || 'demo-user';

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      const [portfolioRes, tradesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/portfolio/${userId}`),
        fetch(`${API_BASE}/portfolio/${userId}/trades`),
        fetch(`${API_BASE}/portfolio/${userId}/stats`)
      ]);

      if (portfolioRes.ok) {
        const data = await portfolioRes.json();
        setPortfolio(data.portfolio);
      }
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyStock = async () => {
    try {
      const response = await fetch(`${API_BASE}/portfolio/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ticker: buyForm.ticker.toUpperCase(),
          quantity: parseInt(buyForm.quantity),
          currentPrice: parseFloat(buyForm.price)
        })
      });

      if (response.ok) {
        setBuyModal(false);
        setBuyForm({ ticker: '', quantity: 1, price: 0 });
        fetchPortfolioData();
      }
    } catch (error) {
      console.error('Error buying stock:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading portfolio...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📈 Paper Trading Portfolio</h1>
        <p className="text-gray-400">Virtual Trading with ₹100,000</p>
      </div>

      {/* Portfolio Summary */}
      {portfolio && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-80">Cash Balance</div>
            <div className="text-2xl font-bold">₹{portfolio.cash?.toFixed(2)}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-80">Total Value</div>
            <div className="text-2xl font-bold">₹{portfolio.totalValue?.toFixed(2)}</div>
          </div>
          <div className={`bg-gradient-to-br ${portfolio.totalGain >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} rounded-lg p-4 text-white`}>
            <div className="text-sm opacity-80">Total Gain/Loss</div>
            <div className="text-2xl font-bold">₹{portfolio.totalGain?.toFixed(2)}</div>
            <div className="text-xs">{portfolio.totalGainPercent?.toFixed(2)}%</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="text-sm opacity-80">Invested</div>
            <div className="text-2xl font-bold">₹{portfolio.totalInvested?.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Trading Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6 bg-gray-900 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalTrades}</div>
            <div className="text-xs text-gray-400">Total Trades</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.winRate}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{stats.buyTrades}</div>
            <div className="text-xs text-gray-400">Buy Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{stats.sellTrades}</div>
            <div className="text-xs text-gray-400">Sell Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">{stats.roi}%</div>
            <div className="text-xs text-gray-400">ROI</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 ${activeTab === 'portfolio' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Active Positions
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 ${activeTab === 'trades' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Trade History
        </button>
      </div>

      {/* Active Positions */}
      {activeTab === 'portfolio' && portfolio?.positions && (
        <div>
          <button
            onClick={() => setBuyModal(true)}
            className="mb-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <ShoppingCart size={18} /> Buy Stock
          </button>

          <div className="space-y-3">
            {portfolio.positions.map((position, idx) => (
              <div key={idx} className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-gray-600">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-bold">{position.ticker}</div>
                    <div className="text-sm text-gray-400">Qty: {position.quantity} @ ₹{position.avgPrice.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">₹{(position.quantity * position.currentPrice).toFixed(2)}</div>
                    <div className={`text-lg font-bold ${position.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.gainLoss >= 0 ? '+' : ''}₹{position.gainLoss.toFixed(2)}
                    </div>
                    <div className={`text-sm ${position.gainLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.gainLossPercent >= 0 ? '+' : ''}{position.gainLossPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      {activeTab === 'trades' && (
        <div className="space-y-2">
          {trades.map((trade, idx) => (
            <div key={idx} className="bg-gray-900 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
              <div>
                <div className="font-bold">{trade.ticker}</div>
                <div className="text-sm text-gray-400">
                  {trade.type === 'BUY' ? 'Bought' : 'Sold'} {trade.quantity} shares @ ₹{trade.price.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${trade.type === 'BUY' ? 'text-red-400' : 'text-green-400'}`}>
                  {trade.type === 'BUY' ? '-' : '+'}₹{trade.totalAmount.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">{new Date(trade.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buy Modal */}
      {buyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Buy Stock</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Ticker (e.g., RELIANCE)"
                value={buyForm.ticker}
                onChange={(e) => setBuyForm({ ...buyForm, ticker: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={buyForm.quantity}
                onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Price (₹)"
                value={buyForm.price}
                onChange={(e) => setBuyForm({ ...buyForm, price: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500"
              />
              <div className="bg-gray-800 rounded p-3 text-sm">
                Total: ₹{(buyForm.quantity * buyForm.price).toFixed(2)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBuyStock}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Buy
                </button>
                <button
                  onClick={() => setBuyModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaperTradingPage;
