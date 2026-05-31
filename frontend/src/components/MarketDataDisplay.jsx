// frontend/src/components/MarketDataDisplay.jsx
// Displays market data with holiday awareness and data categorization

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './MarketDataDisplay.css';

const MarketDataDisplay = () => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('today');

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/market-analysis/market-status-with-data');
      setMarketData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="market-data-loading">
        <div className="spinner"></div>
        <p>Loading market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="market-data-error">
        <p>⚠️ Error: {error}</p>
        <button onClick={fetchMarketData}>Retry</button>
      </div>
    );
  }

  const { marketStatus, today, previous, next } = marketData;

  return (
    <div className="market-data-container">
      {/* Market Status Banner */}
      <div className={`market-status-banner ${marketStatus.isOpen ? 'open' : 'closed'}`}>
        <div className="status-content">
          <h2>{marketStatus.message}</h2>
          <p className="timestamp">Last updated: {new Date(marketData.timestamp).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="market-tabs">
        <button
          className={`tab-button ${selectedTab === 'today' ? 'active' : ''}`}
          onClick={() => setSelectedTab('today')}
        >
          📅 Today
        </button>
        <button
          className={`tab-button ${selectedTab === 'previous' ? 'active' : ''}`}
          onClick={() => setSelectedTab('previous')}
        >
          📊 Previous Trading
        </button>
        <button
          className={`tab-button ${selectedTab === 'next' ? 'active' : ''}`}
          onClick={() => setSelectedTab('next')}
        >
          🔮 Next Trading
        </button>
      </div>

      {/* Tab Content */}
      <div className="market-content">
        {/* Today's Data */}
        {selectedTab === 'today' && (
          <div className="tab-pane">
            {today.isPrimary ? (
              <MarketDataSection title="Today's Market Data" data={today.data} />
            ) : (
              <div className="market-closed-notice">
                <h3>📴 Market Closed Today</h3>
                <p>{today.status}</p>
                <p className="note">Browse previous trading day data below</p>
              </div>
            )}
          </div>
        )}

        {/* Previous Trading Day Data */}
        {selectedTab === 'previous' && (
          <div className="tab-pane">
            {previous.isPrimary ? (
              <div>
                <div className="previous-day-header">
                  <h3>📊 Previous Trading Day Data</h3>
                  <p className="previous-date">{previous.info.dateFormatted}</p>
                  <p className="previous-note">Data from {previous.info.daysAgo} day(s) ago</p>
                </div>
                <MarketDataSection title="" data={previous.data} />
              </div>
            ) : (
              <p className="no-data">No previous trading day data available</p>
            )}
          </div>
        )}

        {/* Next Trading Day Info */}
        {selectedTab === 'next' && (
          <div className="tab-pane">
            {next.info ? (
              <div className="next-day-section">
                <div className="next-day-header">
                  <h3>🔮 Upcoming Trading Day</h3>
                  <p className="next-date">{next.info.dateFormatted}</p>
                  <p className="next-note">In {next.info.daysAway} day(s)</p>
                </div>
                <div className="upcoming-alert">
                  <p>📌 {next.alert || 'Monitor for opportunities on next trading day'}</p>
                </div>
              </div>
            ) : (
              <p className="no-data">No upcoming trading day information</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Market Data Section Component - Displays winners and losers
 */
const MarketDataSection = ({ title, data }) => {
  if (!data) return null;

  return (
    <div className="market-data-section">
      {title && <h3>{title}</h3>}

      {/* Summary Stats */}
      <div className="market-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Analyzed</span>
          <span className="stat-value">{data.totalAnalyzed}</span>
        </div>
        <div className="summary-stat gainers">
          <span className="stat-label">🟢 Winners</span>
          <span className="stat-value">{data.winners?.length || 0}</span>
        </div>
        <div className="summary-stat losers">
          <span className="stat-label">🔴 Losers</span>
          <span className="stat-value">{data.losers?.length || 0}</span>
        </div>
      </div>

      {/* Top Gainers */}
      <div className="market-movers">
        <h4>🚀 Top Gainers (Winners)</h4>
        <div className="stocks-grid">
          {data.topGainers?.slice(0, 5).map((stock) => (
            <StockCard key={stock.ticker} stock={stock} type="gainer" />
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="market-movers">
        <h4>📉 Top Losers</h4>
        <div className="stocks-grid">
          {data.topLosers?.slice(0, 5).map((stock) => (
            <StockCard key={stock.ticker} stock={stock} type="loser" />
          ))}
        </div>
      </div>

      {/* Full Winners List */}
      {data.winners && data.winners.length > 5 && (
        <div className="stocks-list">
          <h4>All Gainers</h4>
          <table className="stocks-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th>Price</th>
                <th>Change %</th>
                <th>Momentum</th>
              </tr>
            </thead>
            <tbody>
              {data.winners.map((stock) => (
                <tr key={stock.ticker} className="gainer-row">
                  <td className="ticker">{stock.ticker}</td>
                  <td>{stock.company}</td>
                  <td className="price">₹{stock.currentPrice?.toFixed(2)}</td>
                  <td className={`change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                  </td>
                  <td className="momentum">{stock.momentum?.direction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Losers List */}
      {data.losers && data.losers.length > 5 && (
        <div className="stocks-list">
          <h4>All Losers</h4>
          <table className="stocks-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th>Price</th>
                <th>Change %</th>
                <th>Momentum</th>
              </tr>
            </thead>
            <tbody>
              {data.losers.map((stock) => (
                <tr key={stock.ticker} className="loser-row">
                  <td className="ticker">{stock.ticker}</td>
                  <td>{stock.company}</td>
                  <td className="price">₹{stock.currentPrice?.toFixed(2)}</td>
                  <td className={`change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                  </td>
                  <td className="momentum">{stock.momentum?.direction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/**
 * Stock Card Component - Displays individual stock info
 */
const StockCard = ({ stock, type }) => {
  return (
    <div className={`stock-card ${type}`}>
      <div className="stock-header">
        <h5>{stock.ticker}</h5>
        <span className={`badge ${type}`}>{type === 'gainer' ? '🟢' : '🔴'}</span>
      </div>
      <p className="company-name">{stock.company}</p>
      <div className="stock-info">
        <div className="price">
          <span className="label">Price</span>
          <span className="value">₹{stock.currentPrice?.toFixed(2)}</span>
        </div>
        <div className={`change ${type}`}>
          <span className="label">Change</span>
          <span className={`value ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}>
            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
          </span>
        </div>
      </div>
      {stock.momentum && (
        <div className="momentum-badge">
          {stock.momentum.strength} {stock.momentum.direction}
        </div>
      )}
    </div>
  );
};

export default MarketDataDisplay;
