import { spawn } from 'child_process'
import path from 'path'
import { createLogger } from '../utils/logger'

const logger = createLogger('yfinance-provider')

interface Quote {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
  source?: string
  currency?: string
  exchange?: string
  sector?: string
  industry?: string
}

interface HistoricalDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface HistoricalData {
  symbol: string
  period: string
  interval: string
  data: HistoricalDataPoint[]
  source?: string
}

export class YFinanceProvider {
  private pythonScript: string

  constructor() {
    this.pythonScript = path.join(__dirname, '../../scripts/yfinance_collector.py')
  }

  private async executePythonScript(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScript, ...args])
      let output = ''
      let errorOutput = ''

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output)
            resolve(result)
          } catch (error) {
            reject(new Error(`Failed to parse JSON output: ${error}`))
          }
        } else {
          reject(new Error(`Python script failed (code ${code}): ${errorOutput}`))
        }
      })

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`))
      })
    })
  }

  private formatSymbolForYahoo(symbol: string): string {
    // Handle exchange-specific formatting
    if (!symbol.includes('.')) {
      // Determine if it's an NSE or NASDAQ symbol
      if (this.isNseSymbol(symbol)) {
        return `${symbol}.NS`  // NSE symbols need .NS suffix
      } else {
        return symbol  // NASDAQ symbols use no suffix
      }
    }
    return symbol
  }

  private isNseSymbol(symbol: string): boolean {
    // Common NSE symbol patterns and known symbols
    const nseSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
      'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
      'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA',
      'NTPC', 'POWERGRID', 'M&M', 'TECHM', 'TITAN', 'COALINDIA', 'INDUSINDBK', 'ADANIPORTS',
      'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'BRITANNIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT',
      'BAJAJ-AUTO', 'HEROMOTOCO', 'HINDALCO', 'CIPLA', 'GRASIM', 'TATASTEEL', 'UPL',
      'JSWSTEEL', 'APOLLOHOSP', 'TATACONSUM', 'ADANIENT', 'LTIM', 'BPCL', 'INDIGO',
      'ADANIGREEN', 'AMBUJACEM', 'BANDHANBNK', 'BIOCON', 'BOSCHLTD', 'CANFINHOME',
      'COLPAL', 'CONCOR', 'COFORGE', 'DABUR', 'DEEPAKNTR', 'DIXON', 'DLF', 'GAIL',
      'GODREJCP', 'GODREJPROP', 'HAVELLS', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB',
      'IOC', 'IRCTC', 'JINDALSTEL', 'JUBLFOOD', 'LUPIN', 'MARICO', 'MINDTREE',
      'NMDC', 'NYKAA', 'OBEROIRLTY', 'OFSS', 'PAGEIND', 'PETRONET', 'PIDILITIND',
      'PNB', 'POLICYBZR', 'RBLBANK', 'SAIL', 'SHREECEM', 'SIEMENS', 'SRF',
      'TORNTPHARM', 'TRENT', 'TVSMOTOR', 'VOLTAS', 'ZEEL', 'ZOMATO', 'MCDOWELL-N',
      'FEDERALBNK', 'BANKBARODA', 'CANBK', 'UNIONBANK', 'YESBANK', 'AUBANK'
    ]
    
    return nseSymbols.includes(symbol.toUpperCase())
  }

  private getExchangeForSymbol(symbol: string): string {
    return this.isNseSymbol(symbol) ? 'NSE' : 'NASDAQ'
  }

  async getQuote(symbol: string): Promise<Quote> {
    const yahooSymbol = this.formatSymbolForYahoo(symbol)
    const exchange = this.getExchangeForSymbol(symbol)
    const currency = exchange === 'NSE' ? 'INR' : 'USD'
    
    try {
      const result = await this.executePythonScript(['quote', '--symbols', yahooSymbol])
      
      if (result.error) {
        throw new Error(result.error)
      }

      const quote = result.quote
      return {
        symbol: symbol, // Return original symbol without suffix
        name: quote.name || symbol,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        volume: quote.volume,
        change: quote.change,
        changePercent: quote.changePercent,
        timestamp: quote.timestamp || new Date().toISOString(),
        currency,
        exchange,
        sector: quote.sector || 'Unknown', // Include sector
        industry: quote.industry || 'Unknown' // Include industry
      }
    } catch (error) {
      logger.error(`Failed to get quote for ${symbol}:`, error)
      throw error
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Quote[]> {
    // Format all symbols for Yahoo Finance with appropriate suffixes
    const yahooSymbols = symbols.map(s => this.formatSymbolForYahoo(s))
    
    try {
      logger.info(`Fetching quotes for ${symbols.length} symbols using yfinance`)
      const result = await this.executePythonScript(['quotes', '--symbols', ...yahooSymbols])
      
      // Debug logging to understand the response format
      logger.debug(`Python script response:`, { 
        hasError: !!result.error,
        hasQuotes: !!result.quotes,
        resultKeys: Object.keys(result),
        resultType: typeof result
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Handle different response formats
      let quotesArray = result.quotes || result || []
      
      if (!Array.isArray(quotesArray)) {
        logger.warn(`Expected quotes array but got:`, { 
          type: typeof quotesArray, 
          value: quotesArray 
        })
        quotesArray = []
      }

      const quotes: Quote[] = quotesArray.map((quote: any, index: number) => {
        const originalSymbol = symbols[index] || `UNKNOWN_${index}`
        const exchange = this.getExchangeForSymbol(originalSymbol)
        const currency = exchange === 'NSE' ? 'INR' : 'USD'
        
        return {
          symbol: originalSymbol, // Use original symbol without suffix
          name: quote.name || originalSymbol,
          price: quote.price,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          previousClose: quote.previousClose,
          volume: quote.volume,
          change: quote.change,
          changePercent: quote.changePercent,
          timestamp: quote.timestamp || new Date().toISOString(),
          currency,
          exchange,
          sector: quote.sector || (exchange === 'NSE' ? 'Indian Stock' : 'US Stock'),
          industry: quote.industry || 'Unknown'
        }
      })

      logger.info(`Successfully fetched ${quotes.length} quotes`)
      return quotes
    } catch (error) {
      logger.error('Failed to get multiple quotes:', error)
      throw error
    }
  }

  async getHistoricalData(symbol: string, period: string = '1y'): Promise<HistoricalData> {
    try {
      logger.info(`Fetching historical data for ${symbol} (${period}) using yfinance`)
      
      const result = await this.executePythonScript([
        'historical',
        '--symbols', symbol,
        '--period', period
      ])

      if (result.error) {
        throw new Error(result.error)
      }

      logger.info(`Successfully fetched historical data for ${symbol}`)
      return result as HistoricalData

    } catch (error) {
      logger.error(`Failed to fetch historical data for ${symbol}:`, error)
      throw error
    }
  }

  async getFundamentalData(symbol: string): Promise<any> {
    try {
      logger.info(`Fetching fundamental data for ${symbol} using yfinance`)
      
      const result = await this.executePythonScript([
        'fundamentals',
        '--symbols', symbol
      ])

      if (result.error) {
        throw new Error(result.error)
      }

      logger.info(`Successfully fetched fundamental data for ${symbol}`)
      return result

    } catch (error) {
      logger.error(`Failed to fetch fundamental data for ${symbol}:`, error)
      throw error
    }
  }

  async searchSymbols(query: string): Promise<any[]> {
    // yfinance doesn't have a built-in search, but we can implement basic validation
    try {
      const quote = await this.getQuote(query.toUpperCase())
      return [{ symbol: quote.symbol, name: quote.name }]
    } catch (error) {
      logger.warn(`Symbol search failed for ${query}:`, error)
      return []
    }
  }

  async getServiceStatus(): Promise<any> {
    try {
      // Test the service by fetching a quote for a known symbol
      await this.getQuote('AAPL')
      
      return {
        status: 'healthy',
        provider: 'yfinance',
        lastCheck: new Date().toISOString(),
        capabilities: [
          'real-time quotes',
          'historical data',
          'fundamental data',
          'bulk quotes'
        ]
      }
    } catch (error) {
      return {
        status: 'error',
        provider: 'yfinance',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      }
    }
  }
} 