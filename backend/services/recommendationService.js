const { getYahooFinance } = require('../utils/yahooClient');
const AnalyticsService = require('./analyticsService');

class RecommendationService {
  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateSmartRecommendations(tickers, avoidList = []) {
    try {
      const recommendations = [];
      const avoidTickers = avoidList.map(a => a.ticker);

      for (const ticker of tickers) {
        // Skip if in avoid list
        if (avoidTickers.includes(ticker)) {
          continue;
        }

        try {
          const yahooFinance = await getYahooFinance();
          const quote = await yahooFinance.quote(ticker);
          const rsi = await this.analyticsService.calculateRSI(ticker);
          const streaks = await this.analyticsService.calculateConsecutiveStreaks(ticker);
          const whyAnalysis = await this.analyticsService.getWhyAnalysis(ticker, quote);

          const score = this._calculateScore({
            rsi,
            changePercent: quote.regularMarketChangePercent || 0,
            volume: quote.regularMarketVolume || 0,
            avgVolume: quote.averageVolume || quote.regularMarketVolume || 0,
            marketCap: quote.marketCap || 0,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
            currentPrice: quote.regularMarketPrice || 0,
            streaks
          });

          if (score.totalScore >= 60) {
            recommendations.push({
              ticker,
              company: quote.longName || quote.shortName,
              price: quote.regularMarketPrice,
              changePercent: quote.regularMarketChangePercent || 0,
              rsi,
              score: score.totalScore,
              recommendation: score.recommendation,
              reasons: score.reasons,
              whyActive: whyAnalysis,
              streaks,
              targetPrice: this._calculateTargetPrice(quote),
              stopLoss: this._calculateStopLoss(quote),
              riskLevel: this._assessRiskLevel(score, quote),
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error(`Error generating recommendation for ${ticker}:`, error.message);
        }

        if (tickers.indexOf(ticker) < tickers.length - 1) {
          await this.sleep(300);
        }
      }

      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Return top 10
    } catch (error) {
      console.error('Error generating smart recommendations:', error.message);
      return [];
    }
  }

  _calculateScore(data) {
    let score = 0;
    const reasons = [];

    // RSI Analysis (30 points)
    if (data.rsi < 30) {
      score += 25;
      reasons.push('Oversold conditions - potential bounce');
    } else if (data.rsi > 70) {
      score -= 15;
      reasons.push('Overbought conditions - caution advised');
    } else if (data.rsi > 50) {
      score += 15;
      reasons.push('Bullish momentum (RSI above 50)');
    }

    // Momentum (25 points)
    if (data.changePercent > 2) {
      score += 20;
      reasons.push('Strong positive momentum');
    } else if (data.changePercent > 0) {
      score += 10;
      reasons.push('Positive price movement');
    } else if (data.changePercent < -3) {
      score -= 20;
      reasons.push('Strong negative momentum');
    }

    // Volume Analysis (20 points)
    const volumeRatio = data.volume / data.avgVolume;
    if (volumeRatio > 1.5) {
      score += 15;
      reasons.push(`Elevated trading volume (${(volumeRatio).toFixed(1)}x average)`);
    } else if (volumeRatio > 1.2) {
      score += 8;
      reasons.push('Above-average volume');
    }

    // Technical Levels (15 points)
    const distanceFromHigh = ((data.fiftyTwoWeekHigh - data.currentPrice) / data.fiftyTwoWeekHigh * 100);
    const distanceFromLow = ((data.currentPrice - data.fiftyTwoWeekLow) / data.fiftyTwoWeekLow * 100);

    if (distanceFromLow > 70) {
      score += 12;
      reasons.push('Trading in upper range of 52-week levels');
    } else if (distanceFromLow < 20) {
      score += 8;
      reasons.push('Potential reversal near support levels');
    }

    // Streak Analysis (10 points)
    if (data.streaks.currentGainStreak >= 2) {
      score += 8;
      reasons.push(`${data.streaks.currentGainStreak}-day winning streak`);
    } else if (data.streaks.currentLossStreak >= 3) {
      score -= 15;
      reasons.push(`${data.streaks.currentLossStreak}-day losing streak - avoid`);
    }

    const recommendation = score >= 70 ? 'STRONG BUY' : score >= 60 ? 'BUY' : score >= 50 ? 'HOLD' : 'AVOID';

    return {
      totalScore: Math.max(0, score),
      recommendation,
      reasons
    };
  }

  _calculateTargetPrice(quote) {
    const currentPrice = quote.regularMarketPrice || 0;
    const high52 = quote.fiftyTwoWeekHigh || currentPrice * 1.3;
    const low52 = quote.fiftyTwoWeekLow || currentPrice * 0.7;
    const range = high52 - low52;
    
    // Target is 50% of range above current price
    return currentPrice + (range * 0.5);
  }

  _calculateStopLoss(quote) {
    const currentPrice = quote.regularMarketPrice || 0;
    const low52 = quote.fiftyTwoWeekLow || currentPrice * 0.7;
    
    // Stop loss at 5% or 52-week low, whichever is higher
    return Math.max(currentPrice * 0.95, low52);
  }

  _assessRiskLevel(score, quote) {
    const volatility = (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow) / quote.fiftyTwoWeekLow * 100;
    const marketCap = quote.marketCap || 0;

    if (score.totalScore >= 80 && volatility < 30 && marketCap > 10000000000) {
      return 'LOW';
    } else if (volatility > 50 || marketCap < 5000000000) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }
}

module.exports = RecommendationService;
