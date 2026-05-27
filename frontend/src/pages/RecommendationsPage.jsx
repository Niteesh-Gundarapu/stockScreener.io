import React, { useState, useEffect } from 'react';
import { Zap, Shield, Target } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const tickers = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'TATAMOTORS.NS'];
      
      const response = await fetch(`${API_BASE}/recommendations/smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, avoidList: [] })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    switch(risk) {
      case 'LOW': return 'bg-green-900 text-green-300';
      case 'MEDIUM': return 'bg-yellow-900 text-yellow-300';
      case 'HIGH': return 'bg-red-900 text-red-300';
      default: return 'bg-gray-900 text-gray-300';
    }
  };

  const getRecommendationColor = (rec) => {
    if (rec.includes('STRONG BUY')) return 'text-green-400';
    if (rec.includes('BUY')) return 'text-green-300';
    if (rec.includes('HOLD')) return 'text-yellow-300';
    return 'text-red-300';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🎯 Smart Recommendations</h1>
        <p className="text-gray-400">AI-Powered Stock Picks Based on Multiple Factors</p>
      </div>

      {loading && <div className="text-center py-12">Loading recommendations...</div>}

      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div key={idx} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600">
            {/* Header */}
            <div className="bg-gray-800 px-6 py-4 flex justify-between items-start">
              <div>
                <div className="text-xl font-bold">{rec.ticker}</div>
                <div className="text-sm text-gray-400">{rec.company}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">₹{rec.price?.toFixed(2)}</div>
                <div className={`font-bold ${rec.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {rec.changePercent >= 0 ? '+' : ''}{rec.changePercent?.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Score & Recommendation */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Score</div>
                    <div className="text-2xl font-bold text-blue-400">{rec.score?.toFixed(1)}/100</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">RSI</div>
                    <div className="text-2xl font-bold text-purple-400">{rec.rsi?.toFixed(1)}</div>
                  </div>
                </div>
                <div>
                  <div className={`text-lg font-bold ${getRecommendationColor(rec.recommendation)}`}>
                    {rec.recommendation}
                  </div>
                  <div className={`text-xs px-3 py-1 rounded ${getRiskColor(rec.riskLevel)} inline-block mt-2`}>
                    Risk: {rec.riskLevel}
                  </div>
                </div>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-gray-400">Target Price</div>
                  <div className="font-bold text-green-400">₹{rec.targetPrice?.toFixed(2)}</div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                  <div className="text-gray-400">Stop Loss</div>
                  <div className="font-bold text-red-400">₹{rec.stopLoss?.toFixed(2)}</div>
                </div>
              </div>

              {/* Reasons */}
              <div>
                <div className="font-bold mb-2 text-sm">Why This Pick?</div>
                <ul className="space-y-1 text-sm text-gray-300">
                  {rec.reasons?.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-400">•</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Why Active */}
              {rec.whyActive?.length > 0 && (
                <div>
                  <div className="font-bold mb-2 text-sm">Why Is It Active?</div>
                  <div className="space-y-2">
                    {rec.whyActive.slice(0, 2).map((item, i) => (
                      <div key={i} className="bg-gray-800 rounded p-2 text-xs text-gray-300">
                        <span className="font-bold text-blue-300">{item.title}</span>: {item.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streaks */}
              {rec.streaks && (
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">Gain Streak:</span>
                    <span className="font-bold text-green-400 ml-1">{rec.streaks.currentGainStreak}d</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Loss Streak:</span>
                    <span className="font-bold text-red-400 ml-1">{rec.streaks.currentLossStreak}d</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {recommendations.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          No strong recommendations available at this time.
        </div>
      )}
    </div>
  );
}

export default RecommendationsPage;
