// Validation utilities for financial data

/**
 * Validate if a value is a valid price
 */
export function isValidPrice(price: number): boolean {
  return !isNaN(price) && price >= 0 && isFinite(price)
}

/**
 * Validate if a value is a valid quantity
 */
export function isValidQuantity(quantity: number): boolean {
  return !isNaN(quantity) && quantity > 0 && Number.isInteger(quantity)
}

/**
 * Validate if a value is a valid percentage
 */
export function isValidPercentage(percentage: number): boolean {
  return !isNaN(percentage) && percentage >= -100 && percentage <= 100
}

/**
 * Validate ISIN (International Securities Identification Number)
 */
export function isValidISIN(isin: string): boolean {
  // ISIN format: 2 letter country code + 9 alphanumeric characters + 1 check digit
  const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/
  
  if (!isinRegex.test(isin)) {
    return false
  }
  
  // Validate check digit using Luhn algorithm
  const digits = isin.split('').map(char => {
    if (isNaN(parseInt(char))) {
      return char.charCodeAt(0) - 55 // Convert letters to numbers (A=10, B=11, etc.)
    }
    return parseInt(char)
  })
  
  let sum = 0
  let isEven = false
  
  for (let i = digits.length - 2; i >= 0; i--) {
    let digit = digits[i]
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit = digit - 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit === digits[digits.length - 1]
}

/**
 * Validate stock symbol
 */
export function isValidSymbol(symbol: string): boolean {
  // Allow 1-5 uppercase letters, optionally followed by a dot and 1-2 letters
  const symbolRegex = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/
  return symbolRegex.test(symbol)
}

/**
 * Validate currency code (ISO 4217)
 */
export function isValidCurrency(currency: string): boolean {
  const validCurrencies = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
    'CNY', 'INR', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK',
    'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY',
    'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'ZAR'
  ]
  
  return validCurrencies.includes(currency)
}

/**
 * Validate market hours
 */
export function isMarketOpen(
  exchange: string,
  date: Date = new Date()
): boolean {
  const day = date.getDay()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const time = hours * 100 + minutes
  
  // Skip weekends
  if (day === 0 || day === 6) {
    return false
  }
  
  // Market hours by exchange (simplified)
  const marketHours: Record<string, { open: number; close: number }> = {
    NSE: { open: 915, close: 1530 },    // 9:15 AM - 3:30 PM IST
    BSE: { open: 915, close: 1530 },    // 9:15 AM - 3:30 PM IST
    NYSE: { open: 930, close: 1600 },   // 9:30 AM - 4:00 PM EST
    NASDAQ: { open: 930, close: 1600 }, // 9:30 AM - 4:00 PM EST
    LSE: { open: 800, close: 1630 },    // 8:00 AM - 4:30 PM GMT
  }
  
  const hours_info = marketHours[exchange]
  if (!hours_info) {
    return false
  }
  
  return time >= hours_info.open && time <= hours_info.close
}

/**
 * Validate order parameters
 */
export function validateOrder(order: {
  quantity: number
  price?: number
  type: string
  side: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!isValidQuantity(order.quantity)) {
    errors.push('Invalid quantity')
  }
  
  if (order.type === 'LIMIT' && (order.price === undefined || !isValidPrice(order.price))) {
    errors.push('Invalid price for limit order')
  }
  
  if (!['BUY', 'SELL'].includes(order.side)) {
    errors.push('Invalid order side')
  }
  
  if (!['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LIMIT'].includes(order.type)) {
    errors.push('Invalid order type')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate portfolio allocation
 */
export function validatePortfolioAllocation(
  allocations: Array<{ symbol: string; percentage: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const total = allocations.reduce((sum, alloc) => sum + alloc.percentage, 0)
  
  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Total allocation must equal 100%, got ${total.toFixed(2)}%`)
  }
  
  for (const alloc of allocations) {
    if (alloc.percentage < 0 || alloc.percentage > 100) {
      errors.push(`Invalid allocation for ${alloc.symbol}: ${alloc.percentage}%`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
} 