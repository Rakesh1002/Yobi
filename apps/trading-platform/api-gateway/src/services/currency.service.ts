export interface ExchangeRates {
  USD: number
  INR: number
  EUR: number
  GBP: number
  JPY: number
  lastUpdated: Date
}

export interface CurrencyConversion {
  originalAmount: number
  originalCurrency: string
  convertedAmount: number
  targetCurrency: string
  exchangeRate: number
  lastUpdated: Date
}

export class CurrencyService {
  private exchangeRates: ExchangeRates | null = null
  private lastFetch: Date | null = null
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Get current exchange rates (cached)
  async getExchangeRates(): Promise<ExchangeRates> {
    const now = new Date()
    
    // Return cached rates if still valid
    if (this.exchangeRates && this.lastFetch && 
        (now.getTime() - this.lastFetch.getTime()) < this.CACHE_DURATION) {
      return this.exchangeRates
    }

    try {
      // Try to fetch from API
      const rates = await this.fetchRatesFromAPI()
      this.exchangeRates = rates
      this.lastFetch = now
      return rates
    } catch (error) {
      console.warn('Failed to fetch exchange rates, using fallback:', error)
      // Return fallback rates if API fails
      return this.getFallbackRates()
    }
  }

  // Convert amount between currencies
  async convertCurrency(
    amount: number, 
    fromCurrency: string, 
    toCurrency: string
  ): Promise<CurrencyConversion> {
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount,
        targetCurrency: toCurrency,
        exchangeRate: 1,
        lastUpdated: new Date()
      }
    }

    const rates = await this.getExchangeRates()
    
    // Convert to USD first, then to target currency
    const fromRate = rates[fromCurrency as keyof ExchangeRates] as number
    const toRate = rates[toCurrency as keyof ExchangeRates] as number
    
    const usdAmount = fromCurrency === 'USD' ? amount : amount / fromRate
    const convertedAmount = toCurrency === 'USD' ? usdAmount : usdAmount * toRate
    const exchangeRate = convertedAmount / amount

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      targetCurrency: toCurrency,
      exchangeRate: Math.round(exchangeRate * 10000) / 10000,
      lastUpdated: rates.lastUpdated
    }
  }

  // Convert multiple prices at once
  async convertPrices(
    prices: Array<{ amount: number; currency: string }>,
    targetCurrency: string
  ): Promise<Array<CurrencyConversion>> {
    const rates = await this.getExchangeRates()
    
    return Promise.all(
      prices.map(price => 
        this.convertCurrency(price.amount, price.currency, targetCurrency)
      )
    )
  }

  // Get formatted currency display
  formatCurrency(amount: number, currency: string): string {
    const formatters: Record<string, Intl.NumberFormat> = {
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
      GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
      JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
    }

    const formatter = formatters[currency] || formatters.USD
    return formatter?.format(amount) || `${amount} ${currency}`
  }

  // Fetch rates from external API
  private async fetchRatesFromAPI(): Promise<ExchangeRates> {
    // Using exchangerate-api.com (free tier)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json() as { rates: Record<string, number> }
    
    return {
      USD: 1, // Base currency
      INR: data.rates?.INR || 83.25,
      EUR: data.rates?.EUR || 0.92,
      GBP: data.rates?.GBP || 0.79,
      JPY: data.rates?.JPY || 148.50,
      lastUpdated: new Date()
    }
  }

  // Fallback rates if API is unavailable
  private getFallbackRates(): ExchangeRates {
    return {
      USD: 1,
      INR: 83.25, // Approximate USD to INR
      EUR: 0.92,  // Approximate USD to EUR
      GBP: 0.79,  // Approximate USD to GBP
      JPY: 148.50, // Approximate USD to JPY
      lastUpdated: new Date()
    }
  }

  // Get supported currencies
  getSupportedCurrencies(): Array<{ code: string; name: string; symbol: string }> {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' }
    ]
  }

  // Get currency symbol
  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      INR: '₹',
      EUR: '€',
      GBP: '£',
      JPY: '¥'
    }
    return symbols[currency] || '$'
  }
}

export const currencyService = new CurrencyService() 