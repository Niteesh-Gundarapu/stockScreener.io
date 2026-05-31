import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Search, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Terminal, 
  Compass, 
  Cpu, 
  BookOpen,
  ArrowUpRight,
  DollarSign,
  Layers,
  Percent
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

function StockIntelligencePanel({ stock }) {
  if (!stock || !stock.newsCatalysts) return null;
  
  const { positive, negative } = stock.newsCatalysts;
  const { sentiment, retailBuyRatio, chatterVolume, publicConsensus } = stock.viewerSentiment || {};
  const brokerages = stock.bigShotRecommendations || [];
  
  return (
    <div className="intelligence-container">
      {/* 1. News Catalysts Panel */}
      <div className="intel-panel glass-card">
        <h4 className="intel-title">
          <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
          Market News & Catalysts
        </h4>
        <div className="news-box">
          {positive && positive.length > 0 && (
            <div className="news-group">
              <span className="news-group-title positive">✓ Why to Buy (Positive Catalysts)</span>
              <ul className="news-list">
                {positive.map((news, idx) => (
                  <li key={idx} className="news-item positive">{news}</li>
                ))}
              </ul>
            </div>
          )}
          {negative && negative.length > 0 && (
            <div className="news-group" style={{ marginTop: '0.5rem' }}>
              <span className="news-group-title negative">✗ Risks to Watch (Reasons NOT to Buy)</span>
              <ul className="news-list">
                {negative.map((news, idx) => (
                  <li key={idx} className="news-item negative">{news}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 2. Retail & Viewer Sentiment Panel */}
      <div className="intel-panel glass-card">
        <h4 className="intel-title">
          <Compass size={14} style={{ color: 'var(--accent-purple)' }} />
          Retail Viewer Sentiment
        </h4>
        <div className="sentiment-meter">
          <div className="sentiment-status-row">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Community Chatter</span>
            <span className={`sentiment-badge ${
              sentiment.toLowerCase().includes('strongly') ? 'strongly-bullish' : 
              sentiment.toLowerCase().includes('bullish') ? 'bullish' : 'neutral'
            }`}>{sentiment}</span>
          </div>

          <div className="sentiment-bar-container">
            <div className="sentiment-bar-label">
              <span>Retail Hype Meter</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{retailBuyRatio} Buy Sentiment</span>
            </div>
            <div className="sentiment-bar-track">
              <div className="sentiment-bar-fill" style={{ width: retailBuyRatio }}></div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
            <strong>Community Opinion:</strong> {publicConsensus}
          </p>
        </div>
      </div>

      {/* 3. Big Shot Institutional Target Cards */}
      <div className="intel-panel glass-card">
        <h4 className="intel-title">
          <Cpu size={14} style={{ color: 'var(--accent-green)' }} />
          Big Shot Recommendations
        </h4>
        <div className="brokerage-box">
          {brokerages.map((b, idx) => (
            <div key={idx} className="brokerage-item">
              <div className="broker-header">
                <span className="broker-name">{b.institution}</span>
                <span className={`broker-call ${b.call.toLowerCase()}`}>{b.call}</span>
              </div>
              <div className="broker-target-row">
                <span className="broker-target">Target Price: {b.target}</span>
                <span className="broker-upside">{b.upside}</span>
              </div>
              <p className="broker-rationale">{b.rationale}</p>
            </div>
          ))}
          {brokerages.length === 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
              No institutional ratings compiled for this stock today.
            </div>
          )}
        </div>
      </div>

      {/* 4. Multi-Day Streak & Current Momentum */}
      {stock.streak && (
        <div className="intel-panel glass-card" style={{ borderLeft: `4px solid ${stock.streak.type === 'Gain' ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
          <h4 className="intel-title">
            <Activity size={14} style={{ color: stock.streak.type === 'Gain' ? 'var(--accent-green)' : 'var(--accent-red)' }} />
            Multi-Day Consecutive Streak Analyzer
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{stock.streak.type === 'Gain' ? '🔥' : '📉'}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>
                  {stock.streak.days}-Day Consecutive {stock.streak.type === 'Gain' ? 'Gain' : 'Loss'} Streak
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Current Momentum: <span style={{ color: stock.streak.type === 'Gain' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>{stock.streak.currentMomentum}</span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.45', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
              <strong>Why Streak Occurred:</strong> {stock.streak.reason}
            </p>
          </div>
        </div>
      )}

      {/* 5. Forward-Looking News Forecast */}
      {stock.forwardOutlook && (
        <div className="intel-panel glass-card">
          <h4 className="intel-title">
            <Compass size={14} style={{ color: 'var(--accent-blue)' }} />
            Next Day & Week Forward Catalyst Outlook
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>📈 Expected Positive Catalysts (Next Week)</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{stock.forwardOutlook.positiveNewsExpectation}</p>
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-red)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>📉 Expected Negative Risks (Next Week)</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{stock.forwardOutlook.negativeNewsExpectation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('picks'); // picks, markets, research
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data States
  const [marketData, setMarketData] = useState(null);
  const [trendingData, setTrendingData] = useState([]);
  const [picksData, setPicksData] = useState([]);
  const [activeMarketFilter, setActiveMarketFilter] = useState('Top Gainers');
  
  // Search & Research States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [researchedStock, setResearchedStock] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  
  // Expanded Pick Card Ticker
  const [expandedPickTicker, setExpandedPickTicker] = useState(null);
  
  // Live socket state
  const [livePrices, setLivePrices] = useState({});
  const socketRef = useRef(null);
  const subscribedTickersRef = useRef(new Set());
  
  // Scraper Terminal Logs
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalEndRef = useRef(null);

  // Live time ticker
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      logTerminal('Connected to WebSocket server for live price updates.', 'success');
    });

    socket.on('price-update', (update) => {
      if (!update || !update.ticker) return;
      setLivePrices((prev) => ({
        ...prev,
        [update.ticker]: update
      }));
    });

    socket.on('disconnect', () => {
      logTerminal('WebSocket disconnected. Live data paused.', 'warning');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      subscribedTickersRef.current.clear();
    };
  }, []);

  const getLiveValue = (ticker, field, fallback) => {
    const live = livePrices[ticker];
    if (live && live[field] !== undefined && live[field] !== null) {
      return live[field];
    }
    return fallback;
  };

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const tickers = new Set();
    const picks = Array.isArray(picksData) ? picksData : (picksData?.recommended || []);
    picks.forEach((pick) => {
      if (pick?.ticker) tickers.add(pick.ticker);
    });

    tickers.forEach((ticker) => {
      if (!subscribedTickersRef.current.has(ticker)) {
        socket.emit('subscribe', ticker);
        subscribedTickersRef.current.add(ticker);
      }
    });
  }, [picksData]);

  // Write a line to the visual terminal
  const logTerminal = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev.slice(-30), { time, text, type }]);
  };

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Initial Data Fetching
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    logTerminal('Initiating Indian stock scanner and diagnostic engine...', 'info');

    try {
      // 1. Fetch market and trending Nifty leaders
      logTerminal('Requesting live HTTP scraping payload from Moneycontrol NSE nodes...', 'info');
      const marketRes = await fetch(`${API_BASE}/market`);
      if (!marketRes.ok) throw new Error('Failed to fetch Indian market details');
      const marketJson = await marketRes.json();
      
      setMarketData(marketJson.market || {});
      setTrendingData(marketJson.trending || []);
      
      if (marketJson.source === 'fallback') {
        logTerminal('WARNING: Moneycontrol scraping blocked. Activated Indian mock diagnostic failover.', 'warning');
      } else {
        logTerminal(`Scraper ONLINE. Successfully parsed NSE top movers and Nifty index leaders.`, 'success');
      }

      // 2. Fetch AI stock picks for Indian market
      logTerminal('Running technical indicators screening (RSI, Moving Averages, Rupee Volume Crossovers)...', 'info');
      const picksRes = await fetch(`${API_BASE}/picks`);
      if (!picksRes.ok) throw new Error('Failed to fetch stock picks');
      const picksJson = await picksRes.json();
      
      setPicksData(picksJson.picks || { recommended: [], avoid: [] });
      
      const recs = picksJson.picks?.recommended || [];
      const avoids = picksJson.picks?.avoid || [];
      if (recs.length > 0 || avoids.length > 0) {
        logTerminal(`Scraper screening complete: Resolved ${recs.length} recommended BUY picks and ${avoids.length} AVOID/SELL alerts.`, 'success');
        // Expand first recommended pick by default
        if (recs.length > 0) {
          setExpandedPickTicker(recs[0].ticker);
        } else if (avoids.length > 0) {
          setExpandedPickTicker(avoids[0].ticker);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Connection to backend server failed. Please verify that the Indian stock Node server is running on port 5000.');
      logTerminal('CRITICAL ERROR: Connection refused by target server. System offline.', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Search Input Changes for NSE/BSE tickers
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success && json.results) {
          setSearchResults(json.results);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Load a stock details into the Research panel (INR format)
  const handleLoadResearchSymbol = async (symbol) => {
    setActiveTab('research');
    setResearchLoading(true);
    setSearchQuery('');
    setShowSearchDropdown(false);
    
    logTerminal(`Connecting to NSE core database for detailed statistics: ${symbol}...`, 'info');
    
    try {
      const res = await fetch(`${API_BASE}/stock/${symbol}`);
      const json = await res.json();
      
      if (json.success) {
        setResearchedStock(json);
        logTerminal(`Successfully compiled detailed profile & chart for ${symbol}.`, 'success');
      } else {
        logTerminal(`Error: Stock details for ${symbol} could not be resolved. Delisted or invalid symbol.`, 'error');
      }
    } catch (err) {
      logTerminal(`Error fetching details for ${symbol}: ${err.message}`, 'error');
    } finally {
      setResearchLoading(false);
    }
  };

  // Custom tooltips for Recharts (INR format)
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(13, 15, 20, 0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '0.65rem',
          borderRadius: '6px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8rem'
        }}>
          <p style={{ color: '#9ca3af', margin: 0 }}>Date: {payload[0].payload.date}</p>
          <p style={{ color: '#fff', fontWeight: 600, margin: '2px 0 0 0' }}>
            Price: <span style={{ color: '#10b981' }}>₹{payload[0].value.toFixed(2)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      {/* 1. HEADER */}
      <header className="app-header glass-card">
        <div className="logo-section">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, var(--accent-green) 0%, var(--accent-blue) 100%)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="logo-text">
            <h1>ApexStock</h1>
            <p>NSE/BSE Indian Web Scraper & AI Picker</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
            <span style={{ color: 'var(--text-muted)' }}>INDIAN STANDARD TIME (IST)</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{currentTime}</span>
          </div>
          
          <div className="status-badge" style={{ color: 'var(--accent-green)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div className="pulse-dot"></div>
            <span>NSE SCANNER OPERATIONAL</span>
          </div>

          <button className="btn btn-secondary" onClick={fetchDashboardData} style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem' }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
            Scan NSE
          </button>
        </div>
      </header>

      {/* 2. NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="nav-container">
          <button 
            className={`nav-tab ${activeTab === 'picks' ? 'active' : ''}`}
            onClick={() => setActiveTab('picks')}
          >
            <Cpu size={16} />
            Today's Picks
          </button>
          <button 
            className={`nav-tab ${activeTab === 'markets' ? 'active' : ''}`}
            onClick={() => setActiveTab('markets')}
          >
            <Compass size={16} />
            Scraped NSE Markets
          </button>
          <button 
            className={`nav-tab ${activeTab === 'research' ? 'active' : ''}`}
            onClick={() => setActiveTab('research')}
          >
            <Search size={16} />
            Indian Stock Research
          </button>
        </div>

        {/* Global Mini Search Bar */}
        <div className="search-wrapper" style={{ maxWidth: '300px' }}>
          <Search size={14} className="search-input-icon" />
          <input 
            type="text" 
            placeholder="Search NSE Tickers (e.g. TCS, TATAMOTORS)..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            style={{ padding: '0.55rem 0.75rem 0.55rem 2.25rem', fontSize: '0.85rem', borderRadius: '8px' }}
          />
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="search-results-dropdown" style={{ top: '110%' }}>
              {searchResults.map(result => (
                <div 
                  key={result.ticker}
                  className="search-result-item"
                  onClick={() => handleLoadResearchSymbol(result.ticker)}
                >
                  <div>
                    <span className="search-result-ticker">{result.ticker}</span>
                    <span className="search-result-name" style={{ marginLeft: '10px' }}>{result.name}</span>
                  </div>
                  <span className="search-result-exchange">{result.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. CORE VIEWS */}
      {loading ? (
        <div className="loading-container glass-card">
          <div className="spinner"></div>
          <span className="loading-text">Scraping Moneycontrol NSE tables & resolving symbols...</span>
        </div>
      ) : error ? (
        <div className="error-state glass-card">
          <AlertTriangle size={48} style={{ color: 'var(--accent-red)' }} />
          <h3 className="error-title">Backend Connection Refused</h3>
          <p className="error-desc">{error}</p>
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: '#fff', fontWeight: 600 }}>Quick Setup Instructions:</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>1. Open a new terminal in the backend directory: <code style={{ color: 'var(--accent-blue)' }}>c:\Niteesh_Dev\stock\backend</code></p>
            <p style={{ color: 'var(--text-secondary)' }}>2. Run the command: <code style={{ color: 'var(--accent-green)' }}>npm run dev</code> or <code style={{ color: 'var(--accent-green)' }}>node index.js</code></p>
            <p style={{ color: 'var(--text-secondary)' }}>3. Once the server says "🚀 Indian Stock Scraper Server is running", click the Scan NSE button above.</p>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: AI PICKS OF THE DAY */}
          {activeTab === 'picks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="picks-header">
                <h2>Today's Indian Stock Recommendations</h2>
                <p>Calculated daily from live Moneycontrol scraped movers and filtered by technical indicators like RSI, volume spurts, and support/resistance crossovers.</p>
              </div>

              {/* 🏆 Recommended Stocks Grid */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>🏆</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-green)', fontSize: '1.1rem', fontWeight: 700 }}>
                    Highly Recommended Stocks (Uptrends & Buy Setups)
                  </h3>
                </div>
                
                <div className="picks-grid">
                  {(Array.isArray(picksData) ? picksData : (picksData.recommended || [])).map(pick => {
                    const livePrice = getLiveValue(pick.ticker, 'price', pick.price);
                    const liveChange = getLiveValue(pick.ticker, 'change', pick.change);
                    const isExpanded = expandedPickTicker === pick.ticker;
                    const isPositive = typeof liveChange === 'number'
                      ? liveChange >= 0
                      : String(liveChange).startsWith('-') === false;
                    
                    return (
                      <div 
                        key={pick.ticker}
                        className={`glass-card pick-card ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => !isExpanded && setExpandedPickTicker(pick.ticker)}
                        style={{ borderTop: '3px solid var(--accent-green)' }}
                      >
                        <div className="pick-card-header">
                          <div className="pick-symbol-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="pick-ticker">{pick.ticker}</span>
                              <span className={`pick-badge ${
                                pick.pickCategory.includes('Momentum') ? 'badge-momentum' :
                                pick.pickCategory.includes('Oversold') ? 'badge-rebound' :
                                pick.pickCategory.includes('Index') ? 'badge-volume' : 'badge-insider'
                              }`}>{pick.pickCategory}</span>
                            </div>
                            <span className="pick-company">{pick.company}</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div className="pick-price-row">
                              <span className="pick-price">₹{livePrice?.toFixed ? livePrice.toFixed(2) : livePrice}</span>
                              <span className={`pick-change ${isPositive ? 'change-positive' : 'change-negative'}`}>
                                {typeof liveChange === 'number' ? `${liveChange >= 0 ? '+' : ''}${liveChange.toFixed(2)}%` : liveChange}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NSE Live Price</span>
                          </div>
                        </div>

                        <div className="pick-parameters">
                          <div className="param-item">
                            <span className="param-label">Entry Range</span>
                            <span className="param-value">{pick.entryRange}</span>
                          </div>
                          <div className="param-item">
                            <span className="param-label">Target Price</span>
                            <span className="param-value target">{pick.targetPrice}</span>
                          </div>
                          <div className="param-item">
                            <span className="param-label">Stop Loss</span>
                            <span className="param-value stop">{pick.stopLoss}</span>
                          </div>
                        </div>

                        <div className="pick-reasoning">
                          <p>{pick.reasoning}</p>
                        </div>

                        {/* Consecutive Streak Badge at Card Footer (collapsible trigger) */}
                        {pick.streak && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>{pick.streak.type === 'Gain' ? '🔥' : '📉'}</span>
                            <span style={{ fontWeight: 600 }}>{pick.streak.days}-Day Streak:</span>
                            <span style={{ color: pick.streak.type === 'Gain' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pick.streak.currentMomentum}</span>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="expanded-content">
                            <div className="expanded-chart-container">
                              <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Activity size={14} style={{ color: 'var(--accent-green)' }} />
                                30-Day Technical Chart Trend
                              </h4>
                              
                              {pick.chartHistory && pick.chartHistory.length > 0 ? (
                                <div style={{ width: '100%', height: '230px' }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={pick.chartHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                      <defs>
                                        <linearGradient id={`colorPrice-${pick.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={isPositive ? 'var(--accent-green)' : 'var(--accent-blue)'} stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor={isPositive ? 'var(--accent-green)' : 'var(--accent-blue)'} stopOpacity={0.0}/>
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={9} dy={10} tickLine={false} />
                                      <YAxis 
                                        stroke="var(--text-muted)" 
                                        fontSize={9} 
                                        domain={['auto', 'auto']} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickFormatter={(v) => `₹${v}`}
                                      />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Area 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke={isPositive ? 'var(--accent-green)' : 'var(--accent-blue)'} 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill={`url(#colorPrice-${pick.ticker})`} 
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                  Chart data unavailable for this stock
                                </div>
                              )}
                            </div>

                            <div className="expanded-details">
                              <h4 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '0.9rem' }}>Detailed Metrics</h4>
                              <div className="detail-metrics-grid">
                                <div className="metric-card">
                                  <span className="metric-label">Risk Rating</span>
                                  <div className="metric-value" style={{ 
                                    color: pick.risk.toLowerCase().includes('high') ? 'var(--accent-red)' : 
                                           pick.risk.toLowerCase().includes('medium') ? 'var(--accent-orange)' : 'var(--accent-green)' 
                                  }}>{pick.risk}</div>
                                </div>
                                <div className="metric-card">
                                  <span className="metric-label">Est. RSI (14d)</span>
                                  <div className="metric-value">{pick.rsiEstimate}</div>
                                </div>
                                <div className="metric-card">
                                  <span className="metric-label">Market Cap</span>
                                  <div className="metric-value">{pick.marketCap}</div>
                                </div>
                                <div className="metric-card">
                                  <span className="metric-label">P/E Ratio</span>
                                  <div className="metric-value">{pick.peRatio}</div>
                                </div>
                                <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                                  <span className="metric-label">52-Week Range</span>
                                  <div className="metric-value">{pick.fiftyTwoWeekRange}</div>
                                </div>
                              </div>

                              <div className="action-bar">
                                <button className="btn btn-primary" onClick={() => handleLoadResearchSymbol(pick.ticker)} style={{ flex: 1, backgroundColor: 'var(--accent-green)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
                                  Technical Research
                                  <ArrowUpRight size={14} />
                                </button>
                                {isExpanded && (
                                  <button className="btn btn-secondary" onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedPickTicker(null);
                                  }}>
                                    Collapse
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Rich Sentiment & News Intelligence Panel */}
                            <StockIntelligencePanel stock={pick} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ⚠️ Non-Recommended / Avoid Stocks Grid */}
              {(!Array.isArray(picksData) && picksData.avoid && picksData.avoid.length > 0) && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-red)', fontSize: '1.1rem', fontWeight: 700 }}>
                      Non-Recommended / Avoid Stocks (Downtrends & Technical Risks)
                    </h3>
                  </div>
                  
                  <div className="picks-grid">
                    {picksData.avoid.map(pick => {
                      const isExpanded = expandedPickTicker === pick.ticker;
                      // FIX: use pick-local live values, not outer scope livePrice/liveChange
                      const avoidLivePrice = getLiveValue(pick.ticker, 'price', pick.price);
                      const avoidLiveChange = getLiveValue(pick.ticker, 'changePercent', pick.changePercent);
                      const avoidChangeStr = typeof pick.change === 'string' ? pick.change : `${(pick.changePercent || 0) >= 0 ? '+' : ''}${(pick.changePercent || 0).toFixed(2)}%`;
                      const isPositive = !avoidChangeStr.startsWith('-');
                      
                      return (
                        <div 
                          key={pick.ticker}
                          className={`glass-card pick-card ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => !isExpanded && setExpandedPickTicker(pick.ticker)}
                          style={{ borderTop: '3px solid var(--accent-red)' }}
                        >
                          <div className="pick-card-header">
                            <div className="pick-symbol-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="pick-ticker">{pick.ticker}</span>
                                <span className="pick-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                  {pick.pickCategory}
                                </span>
                              </div>
                              <span className="pick-company">{pick.company}</span>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div className="pick-price-row">
                                <span className="pick-price">₹{avoidLivePrice?.toFixed ? avoidLivePrice.toFixed(2) : avoidLivePrice}</span>
                                <span className={`pick-change ${isPositive ? 'change-positive' : 'change-negative'}`}>
                                  {typeof avoidLiveChange === 'number' ? `${avoidLiveChange >= 0 ? '+' : ''}${avoidLiveChange.toFixed(2)}%` : avoidChangeStr}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NSE Live Price</span>
                            </div>
                          </div>

                          <div className="pick-parameters">
                            <div className="param-item">
                              <span className="param-label">Consolidation Range</span>
                              <span className="param-value" style={{ color: 'var(--text-muted)' }}>{pick.entryRange}</span>
                            </div>
                            <div className="param-item">
                              <span className="param-label">Downside Pivot</span>
                              <span className="param-value stop" style={{ color: 'var(--accent-red)' }}>{pick.targetPrice}</span>
                            </div>
                            <div className="param-item">
                              <span className="param-label">Support Floor</span>
                              <span className="param-value" style={{ color: 'var(--accent-orange)' }}>{pick.stopLoss}</span>
                            </div>
                          </div>

                          <div className="pick-reasoning">
                            <p>{pick.reasoning}</p>
                          </div>

                          {/* Consecutive Streak Badge at Card Footer */}
                          {pick.streak && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <span>{pick.streak.type === 'Gain' ? '🔥' : '📉'}</span>
                              <span style={{ fontWeight: 600 }}>{pick.streak.days}-Day Streak:</span>
                              <span style={{ color: pick.streak.type === 'Gain' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{pick.streak.currentMomentum}</span>
                            </div>
                          )}

                          {isExpanded && (
                            <div className="expanded-content">
                              <div className="expanded-chart-container">
                                <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Activity size={14} style={{ color: 'var(--accent-red)' }} />
                                  30-Day Technical Chart Trend (Bearish)
                                </h4>
                                
                                {pick.chartHistory && pick.chartHistory.length > 0 ? (
                                  <div style={{ width: '100%', height: '230px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={pick.chartHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <defs>
                                          <linearGradient id={`colorPrice-${pick.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0.0}/>
                                          </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={9} dy={10} tickLine={false} />
                                        <YAxis 
                                          stroke="var(--text-muted)" 
                                          fontSize={9} 
                                          domain={['auto', 'auto']} 
                                          tickLine={false} 
                                          axisLine={false} 
                                          tickFormatter={(v) => `₹${v}`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area 
                                          type="monotone" 
                                          dataKey="price" 
                                          stroke="var(--accent-red)" 
                                          strokeWidth={2}
                                          fillOpacity={1} 
                                          fill={`url(#colorPrice-${pick.ticker})`} 
                                        />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Chart data unavailable for this stock
                                  </div>
                                )}
                              </div>

                              <div className="expanded-details">
                                <h4 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '0.9rem' }}>Detailed Metrics</h4>
                                <div className="detail-metrics-grid">
                                  <div className="metric-card">
                                    <span className="metric-label">Risk Rating</span>
                                    <div className="metric-value" style={{ color: 'var(--accent-red)' }}>{pick.risk}</div>
                                  </div>
                                  <div className="metric-card">
                                    <span className="metric-label">Est. RSI (14d)</span>
                                    <div className="metric-value">{pick.rsiEstimate}</div>
                                  </div>
                                  <div className="metric-card">
                                    <span className="metric-label">Market Cap</span>
                                    <div className="metric-value">{pick.marketCap}</div>
                                  </div>
                                  <div className="metric-card">
                                    <span className="metric-label">P/E Ratio</span>
                                    <div className="metric-value">{pick.peRatio}</div>
                                  </div>
                                  <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                                    <span className="metric-label">52-Week Range</span>
                                    <div className="metric-value">{pick.fiftyTwoWeekRange}</div>
                                  </div>
                                </div>

                                <div className="action-bar">
                                  <button className="btn btn-primary" onClick={() => handleLoadResearchSymbol(pick.ticker)} style={{ flex: 1, backgroundColor: 'var(--accent-red)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}>
                                    Technical Research
                                    <ArrowUpRight size={14} />
                                  </button>
                                  {isExpanded && (
                                    <button className="btn btn-secondary" onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedPickTicker(null);
                                    }}>
                                      Collapse
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Rich Sentiment & News Intelligence Panel */}
                              <StockIntelligencePanel stock={pick} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCRAPED MARKETS */}
          {activeTab === 'markets' && marketData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="picks-header">
                <h2>Live Moneycontrol NSE Scrapes</h2>
                <p>Explore today's live stock tables extracted directly from Moneycontrol's National Stock Exchange (NSE) statistic pipelines.</p>
              </div>

              {/* Nifty Leaders Scroll Bar */}
              {trendingData && trendingData.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={14} style={{ color: 'var(--accent-green)' }} />
                    Nifty 50 Index Leaders (NSE Real-time Feed)
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                    {trendingData.map(t => {
                      const trendChangeStr = typeof t.change === 'string' ? t.change : `${(t.changePercent || 0) >= 0 ? '+' : ''}${(t.changePercent || 0).toFixed(2)}%`;
                      const trendPos = !trendChangeStr.startsWith('-');
                      return (
                        <div 
                          key={t.ticker} 
                          className="metric-card" 
                          onClick={() => handleLoadResearchSymbol(t.ticker)}
                          style={{ minWidth: '160px', cursor: 'pointer', flexShrink: 0, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{t.ticker.replace('.NS', '').replace('.BO', '')}</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600 }} className={trendPos ? 'change-positive' : 'change-negative'}>{trendChangeStr}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{t.company}</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>₹{t.price.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="glass-card markets-container">
                <div className="markets-sidebar" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <h3>NSE Categories</h3>
                  {Object.keys(marketData).map(catName => (
                    <button 
                      key={catName}
                      className={`market-filter-btn ${activeMarketFilter === catName ? 'active' : ''}`}
                      onClick={() => setActiveMarketFilter(catName)}
                    >
                      <span>{catName}</span>
                      <span className="market-filter-count">{marketData[catName].length}</span>
                    </button>
                  ))}
                </div>

                <div className="markets-content">
                  <h3 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {activeMarketFilter} (Moneycontrol Scrape)
                  </h3>

                  <div className="market-table-container">
                    <table className="market-table">
                      <thead>
                        <tr>
                          <th>Stock Name</th>
                          <th style={{ textAlign: 'right' }}>Price (₹)</th>
                          <th style={{ textAlign: 'right' }}>Change %</th>
                          <th style={{ textAlign: 'right' }}>Day High</th>
                          <th style={{ textAlign: 'right' }}>Day Low</th>
                          <th style={{ textAlign: 'right' }}>VWAP / Vol</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketData[activeMarketFilter] && marketData[activeMarketFilter].map((stock, i) => {
                          const stockChangeStr = typeof stock.change === 'string' ? stock.change : `${(stock.changePercent || 0) >= 0 ? '+' : ''}${(stock.changePercent || 0).toFixed(2)}%`;
                          const stockPos = !stockChangeStr.startsWith('-');
                          // Use resolved ticker if available, else fall back to searching by company name
                          const researchTarget = stock.ticker || stock.tickerName || stock.company;
                          return (
                            <tr key={`${stock.company}-${i}`}>
                              <td className="market-table-ticker" style={{ color: '#fff', fontSize: '0.95rem' }}>
                                {stock.ticker && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-blue)', marginRight: '6px' }}>{stock.ticker.replace('.NS','').replace('.BO','')}</span>}
                                {stock.company}
                              </td>
                              <td className="market-table-num" style={{ textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                                ₹{typeof stock.price === 'number' ? stock.price.toLocaleString('en-IN', {minimumFractionDigits: 2}) : stock.price}
                              </td>
                              <td className={`market-table-num ${stockPos ? 'change-positive' : 'change-negative'}`} style={{ textAlign: 'right', fontWeight: 600 }}>
                                {stockChangeStr}
                              </td>
                              <td className="market-table-num" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                {stock.high ? `₹${stock.high}` : '—'}
                              </td>
                              <td className="market-table-num" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                {stock.low ? `₹${stock.low}` : '—'}
                              </td>
                              <td className="market-table-num" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{stock.volume}</td>
                              <td>
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => handleLoadResearchSymbol(researchTarget)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px' }}
                                >
                                  Research
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(!marketData[activeMarketFilter] || marketData[activeMarketFilter].length === 0) && (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                              No stocks found in this category today.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STOCK RESEARCH */}
          {activeTab === 'research' && (
            <div className="research-container">
              <div className="picks-header">
                <h2>Real-time Indian Stock Research</h2>
                <p>Load corporate details, trailing key valuation matrices (P/E, EPS, yield), Nifty industry classifications, and responsive 30-day price trend lines.</p>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, uppercase: 'true', letterSpacing: '1px' }}>Search Indian Symbol Database</label>
                  <div className="search-wrapper" style={{ maxWidth: '600px' }}>
                    <Search size={18} className="search-input-icon" />
                    <input 
                      type="text" 
                      placeholder="Search company (e.g. RELIANCE, TCS, TATA MOTORS, HDFC)..." 
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setShowSearchDropdown(true)}
                    />
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="search-results-dropdown">
                        {searchResults.map(result => (
                          <div 
                            key={result.ticker}
                            className="search-result-item"
                            onClick={() => handleLoadResearchSymbol(result.ticker)}
                          >
                            <div>
                              <span className="search-result-ticker">{result.ticker}</span>
                              <span className="search-result-name" style={{ marginLeft: '12px' }}>{result.name}</span>
                            </div>
                            <span className="search-result-exchange">{result.exchange}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {researchLoading ? (
                  <div className="loading-container" style={{ padding: '2rem' }}>
                    <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
                    <span className="loading-text" style={{ fontSize: '0.9rem' }}>Compiling profile stats from Indian finance nodes...</span>
                  </div>
                ) : researchedStock ? (
                  <div className="research-details-grid">
                    <div className="glass-card ticker-profile-card">
                      <div className="ticker-profile-header">
                        <div className="ticker-profile-meta">
                          <h2>{researchedStock.ticker}</h2>
                          <p>{researchedStock.company}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>₹{researchedStock.price.toFixed(2)}</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600 }} className={!researchedStock.change.startsWith('-') ? 'change-positive' : 'change-negative'}>
                              {researchedStock.change}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NSE Real-time Quote</span>
                        </div>
                      </div>

                      <div className="expanded-chart-container" style={{ minHeight: '300px' }}>
                        <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Activity size={14} style={{ color: 'var(--accent-green)' }} />
                          30-Day Historical Price action (Rupees)
                        </h4>
                        
                        {researchedStock.chartHistory && researchedStock.chartHistory.length > 0 ? (
                          <div style={{ width: '100%', height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={researchedStock.chartHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorResearchPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-green)" stopOpacity="0.3"/>
                                    <stop offset="95%" stopColor="var(--accent-green)" stopOpacity="0.0"/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={9} dy={10} tickLine={false} />
                                <YAxis 
                                  stroke="var(--text-muted)" 
                                  fontSize={9} 
                                  domain={['auto', 'auto']} 
                                  tickLine={false} 
                                  axisLine={false} 
                                  tickFormatter={(v) => `₹${v}`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area 
                                  type="monotone" 
                                  dataKey="price" 
                                  stroke="var(--accent-green)" 
                                  strokeWidth={2}
                                  fillOpacity={1} 
                                  fill="url(#colorResearchPrice)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Chart history not active for this symbol
                          </div>
                        )}
                      </div>

                      <div className="summary-section">
                        <h4 className="summary-header">Company Brief & Business Description</h4>
                        <p className="summary-text">{researchedStock.financials.longBusinessSummary}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BookOpen size={14} style={{ color: 'var(--accent-purple)' }} />
                          Key Indian Valuation Stats
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Market Cap</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#fff' }}>{researchedStock.marketCap}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>P/E Ratio (Trailing)</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#fff' }}>{researchedStock.peRatio}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>EPS (Annual Trailing)</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#fff' }}>₹{researchedStock.eps}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dividend Yield</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#fff' }}>{researchedStock.dividendYield}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>52-Week Range</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#fff', fontSize: '0.8rem' }}>{researchedStock.fiftyTwoWeekRange}</span>
                          </div>
                        </div>
                      </div>

                      <div className="glass-card" style={{ padding: '1.25rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
                          Nifty Sector Group
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', uppercase: 'true' }}>Sector</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#fff' }}>{researchedStock.financials.sector}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', uppercase: 'true' }}>Industry Classification</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#fff' }}>{researchedStock.financials.industry}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Rich Sentiment, Catalysts & Big Shot recommendations */}
                    <StockIntelligencePanel stock={researchedStock} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                    <Search size={32} style={{ marginBottom: '1rem' }} />
                    <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>No NSE/BSE stock loaded. Type in the search box to load stats.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. REAL-TIME DIAGNOSTIC RUN LOGS (TERMINAL COMPONENT) */}
      <footer style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          <Terminal size={14} style={{ color: 'var(--accent-green)' }} />
          Scraper Diagnostic Engine Console (NSE/BSE Feeds)
        </div>
        <div className="terminal-panel">
          {terminalLogs.map((log, index) => (
            <div key={index} className="terminal-line">
              <span className="terminal-prompt">&gt; [{log.time}]</span>
              <span className={
                log.type === 'success' ? 'terminal-success' : 
                log.type === 'warning' ? 'terminal-orange' : 
                log.type === 'error' ? 'terminal-red' : 'terminal-info'
              } style={{ 
                color: log.type === 'success' ? 'var(--accent-green)' : 
                       log.type === 'warning' ? 'var(--accent-orange)' : 
                       log.type === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)'
              }}>
                {log.text}
              </span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          <span>Indian Scraper Core: Moneycontrol Web STATS + Yahoo Finance India Nodes</span>
          <span>© 2026 ApexStock Inc. All trading carries capital risk. NSE/BSE delayed by 15 mins.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
