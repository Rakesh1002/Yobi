// Financial calculations for portfolio metrics and analysis

import Decimal from 'decimal.js'

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return 0
  return ((currentValue - previousValue) / previousValue) * 100
}

/**
 * Calculate profit/loss for a position
 */
export function calculatePnL(
  quantity: number,
  currentPrice: number,
  averagePrice: number,
  fees: number = 0
): {
  pnl: number
  pnlPercent: number
} {
  const investedAmount = quantity * averagePrice
  const currentValue = quantity * currentPrice
  const pnl = currentValue - investedAmount - fees
  const pnlPercent = investedAmount > 0 ? (pnl / investedAmount) * 100 : 0

  return {
    pnl: Number(new Decimal(pnl).toFixed(2)),
    pnlPercent: Number(new Decimal(pnlPercent).toFixed(2))
  }
}

/**
 * Calculate Sharpe Ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const excessReturns = returns.map(r => r - riskFreeRate / 252) // Daily risk-free rate

  const variance = excessReturns.reduce((sum, r) => {
    return sum + Math.pow(r - avgReturn + riskFreeRate / 252, 2)
  }, 0) / returns.length

  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return 0
  
  return ((avgReturn - riskFreeRate / 252) / stdDev) * Math.sqrt(252) // Annualized
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(values: number[]): {
  maxDrawdown: number
  maxDrawdownPercent: number
} {
  if (values.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 }

  let peak = values[0]
  let maxDrawdown = 0
  let maxDrawdownPercent = 0

  for (const value of values) {
    if (value > peak) {
      peak = value
    } else {
      const drawdown = peak - value
      const drawdownPercent = (drawdown / peak) * 100
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
        maxDrawdownPercent = drawdownPercent
      }
    }
  }

  return {
    maxDrawdown: Number(new Decimal(maxDrawdown).toFixed(2)),
    maxDrawdownPercent: Number(new Decimal(maxDrawdownPercent).toFixed(2))
  }
}

/**
 * Calculate portfolio allocation percentages
 */
export function calculatePortfolioAllocations(
  positions: Array<{ marketValue: number }>
): Array<{ allocation: number }> {
  const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0)
  
  return positions.map(pos => ({
    allocation: totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0
  }))
}

/**
 * Calculate risk-adjusted returns (Sortino Ratio)
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0.02,
  targetReturn: number = 0
): number {
  if (returns.length === 0) return 0

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const downwardReturns = returns
    .map(r => Math.min(0, r - targetReturn))
    .map(r => r * r)

  const downwardVariance = downwardReturns.reduce((sum, r) => sum + r, 0) / returns.length
  const downwardDeviation = Math.sqrt(downwardVariance)

  if (downwardDeviation === 0) return 0

  return ((avgReturn - riskFreeRate / 252) / downwardDeviation) * Math.sqrt(252)
}

/**
 * Calculate compound annual growth rate (CAGR)
 */
export function calculateCAGR(
  initialValue: number,
  finalValue: number,
  years: number
): number {
  if (initialValue <= 0 || years <= 0) return 0
  
  const cagr = Math.pow(finalValue / initialValue, 1 / years) - 1
  return Number(new Decimal(cagr * 100).toFixed(2))
}

/**
 * Calculate Value at Risk (VaR)
 */
export function calculateVaR(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0

  const sortedReturns = [...returns].sort((a, b) => a - b)
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length)
  
  return sortedReturns[index] || 0
} 