// Technical indicator calculations

import { OHLCV } from '@yobi/shared-types'

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  
  const sma: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  
  return sma
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  
  const multiplier = 2 / (period + 1)
  const ema: number[] = []
  
  // Start with SMA for first value
  const sma = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema.push(sma)
  
  // Calculate EMA for remaining values
  for (let i = period; i < values.length; i++) {
    const currentValue = values[i]
    const previousEma = ema[ema.length - 1]
    if (currentValue !== undefined && previousEma !== undefined) {
      const emaValue = (currentValue - previousEma) * multiplier + previousEma
      ema.push(emaValue)
    }
  }
  
  return ema
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(values: number[], period: number = 14): number[] {
  if (values.length < period + 1) return []
  
  const rsi: number[] = []
  const gains: number[] = []
  const losses: number[] = []
  
  // Calculate price changes
  for (let i = 1; i < values.length; i++) {
    const currentValue = values[i]
    const previousValue = values[i - 1]
    if (currentValue !== undefined && previousValue !== undefined) {
      const change = currentValue - previousValue
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }
  }
  
  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    const currentGain = gains[i]
    const currentLoss = losses[i]
    if (currentGain !== undefined && currentLoss !== undefined) {
      avgGain = (avgGain * (period - 1) + currentGain) / period
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      rsi.push(100 - (100 / (1 + rs)))
    }
  }
  
  return rsi
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number[]
  signal: number[]
  histogram: number[]
} {
  const emaFast = calculateEMA(values, fastPeriod)
  const emaSlow = calculateEMA(values, slowPeriod)
  
  // Calculate MACD line
  const macd: number[] = []
  const startIndex = slowPeriod - fastPeriod
  
  for (let i = 0; i < Math.min(emaFast.length - startIndex, emaSlow.length); i++) {
    const fastValue = emaFast[i + startIndex]
    const slowValue = emaSlow[i]
    if (fastValue !== undefined && slowValue !== undefined) {
      macd.push(fastValue - slowValue)
    }
  }
  
  // Calculate signal line
  const signal = calculateEMA(macd, signalPeriod)
  
  // Calculate histogram
  const histogram: number[] = []
  for (let i = 0; i < signal.length; i++) {
    const macdValue = macd[i + signalPeriod - 1]
    const signalValue = signal[i]
    if (macdValue !== undefined && signalValue !== undefined) {
      histogram.push(macdValue - signalValue)
    }
  }
  
  return { macd, signal, histogram }
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  values: number[],
  period: number = 20,
  standardDeviations: number = 2
): {
  upper: number[]
  middle: number[]
  lower: number[]
} {
  const middle = calculateSMA(values, period)
  const upper: number[] = []
  const lower: number[] = []
  
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const avg = middle[i - period + 1]
    
    if (avg !== undefined) {
      // Calculate standard deviation
      const variance = slice.reduce((sum, val) => {
        return val !== undefined ? sum + Math.pow(val - avg, 2) : sum
      }, 0) / period
      const stdDev = Math.sqrt(variance)
      
      upper.push(avg + standardDeviations * stdDev)
      lower.push(avg - standardDeviations * stdDev)
    }
  }
  
  return { upper, middle, lower }
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles: OHLCV[], period: number = 14): number[] {
  if (candles.length < period + 1) return []
  
  const trueRanges: number[] = []
  
  // Calculate True Range
  for (let i = 1; i < candles.length; i++) {
    const currentCandle = candles[i]
    const previousCandle = candles[i - 1]
    
    if (currentCandle && previousCandle) {
      const highLow = currentCandle.high - currentCandle.low
      const highPrevClose = Math.abs(currentCandle.high - previousCandle.close)
      const lowPrevClose = Math.abs(currentCandle.low - previousCandle.close)
      
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose))
    }
  }
  
  // Calculate ATR using EMA
  return calculateEMA(trueRanges, period)
}

/**
 * Calculate Stochastic Oscillator
 */
export function calculateStochastic(
  candles: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  k: number[]
  d: number[]
} {
  if (candles.length < kPeriod) return { k: [], d: [] }
  
  const k: number[] = []
  
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1)
    const validCandles = slice.filter(c => c !== undefined)
    
    if (validCandles.length === slice.length) {
      const highestHigh = Math.max(...validCandles.map(c => c.high))
      const lowestLow = Math.min(...validCandles.map(c => c.low))
      
      const currentCandle = candles[i]
      if (currentCandle) {
        const currentClose = currentCandle.close
        const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
        k.push(kValue)
      }
    }
  }
  
  const d = calculateSMA(k, dPeriod)
  
  return { k, d }
} 