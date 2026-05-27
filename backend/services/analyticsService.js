const { getYahooFinance } = require('../utils/yahooClient');

class AnalyticsService {
  async calculateConsecutiveStreaks(ticker, days = 30) {
    try {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - days);

      const yahooFinance = await getYahooFinance();
      const chartData = await yahooFinance.chart(ticker, {
        period1: pastDate,
        period2: today,
        interval: '1d'
      });

      if (!chartData || !chartData.quotes || chartData.quotes.length < 2) {
        return { gainStreak: 0, lossStreak: 0, currentStreak: 'none', streakDays: 0 };
      }

      const quotes = chartData.quotes.map(q => ({
        date: q.date,
        close: q.close || q.adjustedClose
      })).sort((a, b) => a.date - b.date);

      let gainStreak = 0;
      let lossStreak = 0;
      let currentStreak = 'none';
      let maxGainStreak = 0;
      let maxLossStreak = 0;

      for (let i = 1; i < quotes.length; i++) {
        const change = quotes[i].close - quotes[i - 1].close;

        if (change > 0) {
          gainStreak++;
          lossStreak = 0;
          currentStreak = 'gain';
          maxGainStreak = Math.max(maxGainStreak, gainStreak);
        } else if (change < 0) {
          lossStreak++;
          gainStreak = 0;
          currentStreak = 'loss';
          maxLossStreak = Math.max(maxLossStreak, lossStreak);
        } else {
          gainStreak = 0;
          lossStreak = 0;
          currentStreak = 'flat';
        }
      }

      return {
        currentGainStreak: gainStreak,
        currentLossStreak: lossStreak,
        maxGainStreak,
        maxLossStreak,
        currentStreak,
        lastUpdate: new Date()
      };
    } catch (error) {
      console.error(`Error calculating streaks for ${ticker}:`, error.message);
      return { gainStreak: 0, lossStreak: 0, currentStreak: 'none', streakDays: 0 };
    }
  }

  async getMostActiveStocks(tickers, timeframe = '1d') {
    try {
      const today = new Date();
      const pastDate = new Date();
      
      if (timeframe === '1d') {
        pastDate.setDate(today.getDate() - 1);
      } else if (timeframe === '1w') {
        pastDate.setDate(today.getDate() - 7);
      } else {
        pastDate.setDate(today.getDate() - 30);
      }

      const activeStocks = [];

      for (const ticker of tickers) {
        try {
          const yahooFinance = await getYahooFinance();
          const quote = await yahooFinance.quote(ticker);
          const volume = quote.regularMarketVolume || 0;
          const changePercent = quote.regularMarketChangePercent || 0;
          const change = quote.regularMarketChange || 0;

          const activityScore = (Math.abs(changePercent) * 2) + (volume / 1000000);

          activeStocks.push({
            ticker,
            name: quote.longName || quote.shortName,
            price: quote.regularMarketPrice,
            change,
            changePercent,
            volume,
            volumeInMillion: volume / 1000000,
            activityScore,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow
          });
        } catch (error) {
          console.error(`Error fetching data for ${ticker}:`, error.message);
        }
      }

      // Sort by activity score
      return activeStocks.sort((a, b) => b.activityScore - a.activityScore);
    } catch (error) {
      console.error('Error getting most active stocks:', error.message);
      return [];
    }
  }

  async getWhyAnalysis(ticker, quote = null) {
    try {
      if (!quote) {
        const yahooFinance = await getYahooFinance();
        quote = await yahooFinance.quote(ticker);
      }

      const changePercent = quote.regularMarketChangePercent || 0;
      const volume = quote.regularMarketVolume || 0;
      const prevClose = quote.regularMarketPreviousClose || 0;
      const change = quote.regularMarketChange || 0;

      const reasons = [];

      // Volume analysis
      const avgVolume = quote.averageVolume || volume;
      if (volume > avgVolume * 1.5) {
        reasons.push({
          type: 'VOLUME',
          title: 'Unusual Volume Activity',
          description: `Trading volume is ${((volume / avgVolume - 1) * 100).toFixed(1)}% above average, indicating strong investor interest`,
          impact: 'POSITIVE'
        });
      }

      // Price movement analysis
      if (Math.abs(changePercent) > 3) {
        reasons.push({
          type: 'MOMENTUM',
          title: changePercent > 0 ? 'Strong Upward Momentum' : 'Strong Downward Momentum',
          description: `Stock moved ${Math.abs(changePercent).toFixed(2)}% in a single day, indicating significant market sentiment shift`,
          impact: changePercent > 0 ? 'POSITIVE' : 'NEGATIVE'
        });
      }

      // Technical level analysis
      const fiftyTwoWeekHigh = quote.fiftyTwoWeekHigh || 0;
      const fiftyTwoWeekLow = quote.fiftyTwoWeekLow || 0;
      const currentPrice = quote.regularMarketPrice || 0;

      const distanceFromHigh = ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh * 100).toFixed(1);
      const distanceFromLow = ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow * 100).toFixed(1);

      if (distanceFromHigh < 5) {
        reasons.push({
          type: 'TECHNICAL',
          title: 'Near 52-Week High',
          description: `Stock is trading near its 52-week high (${distanceFromHigh}% below), suggesting strong long-term momentum`,
          impact: 'POSITIVE'
        });
      }

      if (distanceFromLow < 5) {
        reasons.push({
          type: 'TECHNICAL',
          title: 'Near 52-Week Low',
          description: `Stock is trading near its 52-week low (${distanceFromLow}% above), potentially oversold`,
          impact: 'NEGATIVE'
        });
      }

      // Sentiment from news
      try {
        const yahooFinance = await getYahooFinance();
        const searchResult = await yahooFinance.search(ticker);
        const newsCount = (searchResult.news || []).length;
        if (newsCount > 0) {
          reasons.push({
            type: 'NEWS',
            title: `Active News Coverage (${newsCount} articles)`,
            description: `${newsCount} news articles available, indicating strong market attention`,
            impact: 'NEUTRAL'
          });
        }
      } catch (error) {
        console.error('Error fetching news for why analysis:', error.message);
      }

      return reasons;
    } catch (error) {
      console.error(`Error getting why analysis for ${ticker}:`, error.message);
      return [];
    }
  }

  async calculateRSI(ticker, period = 14) {
    try {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - (period * 2));

      const yahooFinance = await getYahooFinance();
      const chartData = await yahooFinance.chart(ticker, {
        period1: pastDate,
        period2: today,
        interval: '1d'
      });

      if (!chartData || !chartData.quotes || chartData.quotes.length < period) {
        return 50; // Neutral if insufficient data
      }

      const closes = chartData.quotes
        .map(q => q.close || q.adjustedClose)
        .reverse()
        .slice(0, period + 1);

      let gains = 0;
      let losses = 0;

      for (let i = 0; i < closes.length - 1; i++) {
        const change = closes[i] - closes[i + 1];
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      const avgGain = gains / period;
      const avgLoss = losses / period;

      if (avgLoss === 0) return 100;
      if (avgGain === 0) return 0;

      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      return rsi;
    } catch (error) {
      console.error(`Error calculating RSI for ${ticker}:`, error.message);
      return 50;
    }
  }

  generateAvoidList(stocks) {
    const avoidList = [];

    stocks.forEach(stock => {
      let avoidScore = 0;
      const reasons = [];

      // Extended loss streak
      if (stock.currentLossStreak >= 3) {
        avoidScore += 40;
        reasons.push(`${stock.currentLossStreak}-day loss streak`);
      }

      // High negative change
      if (stock.changePercent < -5) {
        avoidScore += 30;
        reasons.push(`Large single-day drop: ${stock.changePercent.toFixed(2)}%`);
      }

      // Near 52-week low
      if (stock.price <= stock.fiftyTwoWeekLow * 1.05) {
        avoidScore += 25;
        reasons.push('Trading near 52-week low');
      }

      // Low volume
      if (stock.volume < stock.averageVolume * 0.5) {
        avoidScore += 15;
        reasons.push('Below-average trading volume');
      }

      if (avoidScore >= 30) {
        avoidList.push({
          ticker: stock.ticker,
          avoidScore,
          reasons,
          timestamp: new Date()
        });
      }
    });

    return avoidList.sort((a, b) => b.avoidScore - a.avoidScore);
  }
}

module.exports = AnalyticsService;
