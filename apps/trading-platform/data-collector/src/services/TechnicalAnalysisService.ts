import { prisma } from '@yobi/database'
import { cache } from '@yobi/database/src/redis'
import { 
  calculateSMA, 
  calculateEMA, 
  calculateRSI, 
  calculateMACD, 
  calculateBollingerBands, 
  calculateATR, 
  calculateStochastic 
} from '@yobi/financial-utils/src/indicators'
import { createLogger } from '../utils/logger'

const logger = createLogger('technical-analysis')

export interface TechnicalIndicators {
  symbol: string
  timestamp: Date
  rsi: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  ema12: number | null
  ema26: number | null
  macd: {
    value: number | null
    signal: number | null
    histogram: number | null
  }
  bollingerBands: {
    upper: number | null
    middle: number | null
    lower: number | null
  }
  atr: number | null
  stochastic: {
    k: number | null
    d: number | null
  }
  signal: 'BUY' | 'SELL' | 'HOLD'
  signalStrength: number
}

export class TechnicalAnalysisService {
  
  /**
   * Calculate technical indicators for a symbol
   */
  async calculateIndicators(symbol: string, lookbackPeriod: number = 200): Promise<TechnicalIndicators | null> {
    try {
      logger.info(`Calculating technical indicators for ${symbol}`)

      // Get historical market data
      const marketData = await this.getMarketData(symbol, lookbackPeriod)
      
      if (marketData.length < 50) {
        logger.warn(`Insufficient data for ${symbol}: ${marketData.length} points`)
        return null
      }

      // Extract price and volume arrays
      const closes = marketData.map((d: any) => d.close)
      const highs = marketData.map((d: any) => d.high)
      const lows = marketData.map((d: any) => d.low)
      const volumes = marketData.map((d: any) => Number(d.volume))
      const candles = marketData.map((d: any) => ({
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: Number(d.volume)
      }))

      // Calculate indicators
      const rsi = calculateRSI(closes, 14)
      const sma20 = calculateSMA(closes, 20)
      const sma50 = calculateSMA(closes, 50)
      const sma200 = calculateSMA(closes, 200)
      const ema12 = calculateEMA(closes, 12)
      const ema26 = calculateEMA(closes, 26)
      const macd = calculateMACD(closes, 12, 26, 9)
      const bollinger = calculateBollingerBands(closes, 20, 2)
      const atr = calculateATR(candles, 14)
      const stochastic = calculateStochastic(candles, 14, 3)

      // Get latest values
      const latestRSI = rsi.length > 0 ? (rsi[rsi.length - 1] ?? null) : null
      const latestSMA20 = sma20.length > 0 ? (sma20[sma20.length - 1] ?? null) : null
      const latestSMA50 = sma50.length > 0 ? (sma50[sma50.length - 1] ?? null) : null
      const latestSMA200 = sma200.length > 0 ? (sma200[sma200.length - 1] ?? null) : null
      const latestEMA12 = ema12.length > 0 ? (ema12[ema12.length - 1] ?? null) : null
      const latestEMA26 = ema26.length > 0 ? (ema26[ema26.length - 1] ?? null) : null
      const latestMACDValue = macd.macd.length > 0 ? (macd.macd[macd.macd.length - 1] ?? null) : null
      const latestMACDSignal = macd.signal.length > 0 ? (macd.signal[macd.signal.length - 1] ?? null) : null
      const latestMACDHistogram = macd.histogram.length > 0 ? (macd.histogram[macd.histogram.length - 1] ?? null) : null
      const latestBollingerUpper = bollinger.upper.length > 0 ? (bollinger.upper[bollinger.upper.length - 1] ?? null) : null
      const latestBollingerMiddle = bollinger.middle.length > 0 ? (bollinger.middle[bollinger.middle.length - 1] ?? null) : null
      const latestBollingerLower = bollinger.lower.length > 0 ? (bollinger.lower[bollinger.lower.length - 1] ?? null) : null
      const latestATR = atr.length > 0 ? (atr[atr.length - 1] ?? null) : null
      const latestStochasticK = stochastic.k.length > 0 ? (stochastic.k[stochastic.k.length - 1] ?? null) : null
      const latestStochasticD = stochastic.d.length > 0 ? (stochastic.d[stochastic.d.length - 1] ?? null) : null

      // Generate trading signal
      const { signal, signalStrength } = this.generateTradingSignal({
        rsi: latestRSI,
        sma20: latestSMA20,
        sma50: latestSMA50,
        currentPrice: closes[closes.length - 1],
        macdValue: latestMACDValue,
        macdSignal: latestMACDSignal,
        stochasticK: latestStochasticK
      })

      const indicators: TechnicalIndicators = {
        symbol,
        timestamp: marketData[marketData.length - 1].timestamp,
        rsi: latestRSI,
        sma20: latestSMA20,
        sma50: latestSMA50,
        sma200: latestSMA200,
        ema12: latestEMA12,
        ema26: latestEMA26,
        macd: {
          value: latestMACDValue,
          signal: latestMACDSignal,
          histogram: latestMACDHistogram
        },
        bollingerBands: {
          upper: latestBollingerUpper,
          middle: latestBollingerMiddle,
          lower: latestBollingerLower
        },
        atr: latestATR,
        stochastic: {
          k: latestStochasticK,
          d: latestStochasticD
        },
        signal,
        signalStrength
      }

      // Store indicators in cache for fast access
      await this.cacheIndicators(symbol, indicators)

      logger.info(`Calculated technical indicators for ${symbol}: ${signal} (${signalStrength.toFixed(2)})`)
      return indicators

    } catch (error) {
      logger.error(`Failed to calculate indicators for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate technical indicators for multiple symbols
   */
  async calculateIndicatorsForSymbols(symbols: string[]): Promise<Map<string, TechnicalIndicators>> {
    const results = new Map<string, TechnicalIndicators>()

    for (const symbol of symbols) {
      try {
        const indicators = await this.calculateIndicators(symbol)
        if (indicators) {
          results.set(symbol, indicators)
        }
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        logger.error(`Failed to calculate indicators for ${symbol}:`, error)
      }
    }

    logger.info(`Calculated indicators for ${results.size}/${symbols.length} symbols`)
    return results
  }

  /**
   * Get cached technical indicators
   */
  async getCachedIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    try {
      const cached = await cache.get(`technical:${symbol}`)
      return cached ? JSON.parse(cached as string) : null
    } catch (error) {
      logger.error(`Failed to get cached indicators for ${symbol}:`, error)
      return null
    }
  }

  private async getMarketData(symbol: string, lookbackPeriod: number) {
    return await prisma.marketData.findMany({
      where: {
        instrument: {
          symbol: symbol.toUpperCase()
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: lookbackPeriod
    })
  }

  private async cacheIndicators(symbol: string, indicators: TechnicalIndicators) {
    try {
      await cache.set(`technical:${symbol}`, JSON.stringify(indicators), 300) // 5 minute cache
    } catch (error) {
      logger.error(`Failed to cache indicators for ${symbol}:`, error)
    }
  }

  private generateTradingSignal(params: {
    rsi: number | null
    sma20: number | null
    sma50: number | null
    currentPrice: number
    macdValue: number | null
    macdSignal: number | null
    stochasticK: number | null
  }): { signal: 'BUY' | 'SELL' | 'HOLD', signalStrength: number } {
    
    let buySignals = 0
    let sellSignals = 0
    let totalIndicators = 0

    // RSI signals
    if (params.rsi !== null) {
      totalIndicators++
      if (params.rsi < 30) buySignals++
      else if (params.rsi > 70) sellSignals++
    }

    // Moving average signals
    if (params.sma20 !== null && params.sma50 !== null) {
      totalIndicators++
      if (params.currentPrice > params.sma20 && params.sma20 > params.sma50) {
        buySignals++
      } else if (params.currentPrice < params.sma20 && params.sma20 < params.sma50) {
        sellSignals++
      }
    }

    // MACD signals
    if (params.macdValue !== null && params.macdSignal !== null) {
      totalIndicators++
      if (params.macdValue > params.macdSignal && params.macdValue > 0) {
        buySignals++
      } else if (params.macdValue < params.macdSignal && params.macdValue < 0) {
        sellSignals++
      }
    }

    // Stochastic signals
    if (params.stochasticK !== null) {
      totalIndicators++
      if (params.stochasticK < 20) buySignals++
      else if (params.stochasticK > 80) sellSignals++
    }

    // Calculate signal strength (0-1)
    const signalStrength = totalIndicators > 0 
      ? Math.max(buySignals, sellSignals) / totalIndicators 
      : 0

    // Determine overall signal
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
    
    if (buySignals > sellSignals && signalStrength >= 0.6) {
      signal = 'BUY'
    } else if (sellSignals > buySignals && signalStrength >= 0.6) {
      signal = 'SELL'
    }

    return { signal, signalStrength }
  }
} 