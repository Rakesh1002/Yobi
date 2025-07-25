// Formatting utilities for financial data

/**
 * Determine currency code from exchange
 */
export function getCurrencyFromExchange(exchange: string): string {
  switch (exchange?.toUpperCase()) {
    case 'NSE':
    case 'BSE':
      return 'INR'
    case 'NYSE':
    case 'NASDAQ':
    case 'AMEX':
      return 'USD'
    case 'LSE':
      return 'GBP'
    case 'FRA':
    case 'XETR':
      return 'EUR'
    case 'TSE':
      return 'JPY'
    default:
      return 'USD' // Default fallback
  }
}

/**
 * Format currency with appropriate symbol and decimals
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Format large numbers with abbreviations (K, M, B, T)
 */
export function formatLargeNumber(value: number): string {
  const absValue = Math.abs(value)
  
  if (absValue >= 1e12) {
    return `${(value / 1e12).toFixed(2)}T`
  } else if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`
  }
  
  return value.toFixed(2)
}

/**
 * Format percentage with appropriate sign and decimals
 */
export function formatPercentage(
  value: number,
  decimals: number = 2,
  includeSign: boolean = true
): string {
  const formatted = value.toFixed(decimals)
  const sign = includeSign && value > 0 ? '+' : ''
  return `${sign}${formatted}%`
}

/**
 * Format price with appropriate decimals based on value
 */
export function formatPrice(value: number, currency: string = 'USD'): string {
  let decimals = 2
  
  if (value < 1) {
    decimals = 4
  } else if (value < 10) {
    decimals = 3
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

/**
 * Format volume with appropriate units
 */
export function formatVolume(value: number): string {
  return formatLargeNumber(value).replace(/\.\d+/, '')
}

/**
 * Format market cap
 */
export function formatMarketCap(value: number, currency: string = 'USD'): string {
  const formatted = formatLargeNumber(value)
  return `${currency} ${formatted}`
}

/**
 * Format date for display
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'medium' | 'long' | 'time' = 'medium'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'medium':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'long':
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    default:
      return d.toLocaleDateString()
  }
}

/**
 * Format time difference (e.g., "2 hours ago", "in 5 minutes")
 */
export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) {
    return 'just now'
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
  } else {
    return formatDate(d, 'short')
  }
}

/**
 * Format ratio (e.g., P/E ratio)
 */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A'
  }
  
  return value.toFixed(2)
}

/**
 * Format basis points
 */
export function formatBasisPoints(value: number): string {
  return `${value.toFixed(0)} bps`
} 