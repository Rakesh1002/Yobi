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
    const emaValue = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]
    ema.push(emaValue)
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
    const change = values[i] - values[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Calculate RSI
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi.push(100 - (100 / (1 + rs)))
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
    macd.push(emaFast[i + startIndex] - emaSlow[i])
  }
  
  // Calculate signal line
  const signal = calculateEMA(macd, signalPeriod)
  
  // Calculate histogram
  const histogram: number[] = []
  for (let i = 0; i < signal.length; i++) {
    histogram.push(macd[i + signalPeriod - 1] - signal[i])
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
    
    // Calculate standard deviation
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period
    const stdDev = Math.sqrt(variance)
    
    upper.push(avg + standardDeviations * stdDev)
    lower.push(avg - standardDeviations * stdDev)
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
    const highLow = candles[i].high - candles[i].low
    const highPrevClose = Math.abs(candles[i].high - candles[i - 1].close)
    const lowPrevClose = Math.abs(candles[i].low - candles[i - 1].close)
    
    trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose))
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
    const highestHigh = Math.max(...slice.map(c => c.high))
    const lowestLow = Math.min(...slice.map(c => c.low))
    
    const currentClose = candles[i].close
    const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
    k.push(kValue)
  }
  
  const d = calculateSMA(k, dPeriod)
  
  return { k, d }
} 