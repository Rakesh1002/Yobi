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

      // Handle different response formats - the Python script returns quote directly
      const quote = result.quote || result
      
      if (!quote || typeof quote !== 'object') {
        throw new Error(`Invalid quote data received for ${symbol}`)
      }
      
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

  async searchSymbols(query: string): Promise<{ symbol: string; name: string }[]> {
    logger.info(`Searching for symbols matching: ${query}`)
    
    const results: { symbol: string; name: string }[] = []
    
    // Strategy 1: Direct symbol lookup (existing functionality)
    try {
      const quote = await this.getQuote(query.toUpperCase())
      results.push({ symbol: quote.symbol, name: quote.name || quote.symbol })
      logger.info(`Found direct symbol match for ${query}: ${quote.symbol}`)
      return results
    } catch (error) {
      logger.debug(`Direct symbol lookup failed for ${query}:`, error instanceof Error ? (error.message || 'Unknown error') : String(error))
    }
    
    // Strategy 2: Enhanced company name search using Python script
    try {
      const searchResults = await this.executePythonScript(['search', '--query', query])
      
      if (searchResults.error) {
        logger.warn(`Python search failed: ${searchResults.error}`)
      } else if (searchResults.results && Array.isArray(searchResults.results)) {
        results.push(...searchResults.results)
        logger.info(`Found ${searchResults.results.length} results from enhanced search`)
        return results
      }
    } catch (error) {
      logger.debug(`Enhanced search failed for ${query}:`, error instanceof Error ? (error.message || 'Unknown error') : String(error))
    }
    
    // Strategy 3: Common symbol pattern matching
    const commonPatterns = this.getCommonSymbolPatterns(query)
    for (const pattern of commonPatterns) {
      try {
        const quote = await this.getQuote(pattern)
        results.push({ symbol: quote.symbol, name: quote.name || quote.symbol })
        logger.info(`Found pattern match for ${query}: ${pattern} -> ${quote.symbol}`)
        return results
      } catch (error) {
        logger.debug(`Pattern ${pattern} failed for ${query}`)
      }
    }
    
    // Strategy 4: Web search fallback (if available)
    try {
      const webSearchResults = await this.performWebSearchFallback(query)
      if (webSearchResults.length > 0) {
        results.push(...webSearchResults)
        logger.info(`Found ${webSearchResults.length} results from web search fallback`)
        return results
      }
    } catch (error) {
      logger.debug(`Web search fallback failed for ${query}:`, error instanceof Error ? error.message : String(error))
    }
    
    logger.warn(`No search results found for query: ${query}`)
    return results
  }

  private getCommonSymbolPatterns(query: string): string[] {
    const patterns: string[] = []
    const cleanQuery = query.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    
    // Common company name to symbol mappings
    const companyMappings: { [key: string]: string[] } = {
      'APPLE': ['AAPL'],
      'MICROSOFT': ['MSFT'],
      'GOOGLE': ['GOOGL', 'GOOG'],
      'ALPHABET': ['GOOGL', 'GOOG'],
      'AMAZON': ['AMZN'],
      'TESLA': ['TSLA'],
      'META': ['META'],
      'FACEBOOK': ['META'],
      'NVIDIA': ['NVDA'],
      'NETFLIX': ['NFLX'],
      'INTEL': ['INTC'],
      'IBM': ['IBM'],
      'ORACLE': ['ORCL'],
      'SALESFORCE': ['CRM'],
      'ZOOM': ['ZM'],
      'TWITTER': ['TWTR'],
      'UBER': ['UBER'],
      'LYFT': ['LYFT'],
      'AIRBNB': ['ABNB'],
      'PAYPAL': ['PYPL'],
      'SQUARE': ['SQ'],
      'SHOPIFY': ['SHOP'],
      'SPOTIFY': ['SPOT'],
      'ADOBE': ['ADBE'],
      'CISCO': ['CSCO'],
      'WALMART': ['WMT'],
      'DISNEY': ['DIS'],
      'BOEING': ['BA'],
      'JPMORGAN': ['JPM'],
      'GOLDMAN': ['GS'],
      'MORGAN': ['MS'],
      'RELIANCE': ['RELIANCE.NS'],
      'TCS': ['TCS.NS'],
      'INFOSYS': ['INFY.NS'],
      'WIPRO': ['WIPRO.NS'],
      'HDFC': ['HDFCBANK.NS'],
      'ICICI': ['ICICIBANK.NS'],
      'SBI': ['SBIN.NS'],
      'BHARTI': ['BHARTIARTL.NS'],
      'ADANI': ['ADANIPORTS.NS'],
      'TATA': ['TATAMOTORS.NS', 'TATASTEEL.NS', 'TATAPOWER.NS']
    }
    
    // Check for exact company name matches
    if (companyMappings[cleanQuery]) {
      patterns.push(...companyMappings[cleanQuery])
    }
    
    // Check for partial matches
    for (const [company, symbols] of Object.entries(companyMappings)) {
      if (company.includes(cleanQuery) || cleanQuery.includes(company)) {
        patterns.push(...symbols)
      }
    }
    
    // Add common suffixes for Indian stocks
    if (this.isLikelyIndianCompany(cleanQuery)) {
      patterns.push(`${cleanQuery}.NS`, `${cleanQuery}.BO`)
    }
    
    // Add the original query as-is
    patterns.push(cleanQuery)
    
    return [...new Set(patterns)] // Remove duplicates
  }
  
  private isLikelyIndianCompany(query: string): boolean {
    const indianIndicators = [
      'LTD', 'LIMITED', 'INDUSTRIES', 'MOTORS', 'BANK', 'FINANCE',
      'POWER', 'STEEL', 'CHEMICALS', 'PHARMA', 'TECH', 'SYSTEMS'
    ]
    return indianIndicators.some(indicator => query.includes(indicator))
  }

  private async performWebSearchFallback(query: string): Promise<{ symbol: string; name: string }[]> {
    // This would integrate with web search service if available
    // For now, we'll implement a basic fallback that could be enhanced
    
    logger.info(`Attempting web search fallback for: ${query}`)
    
    try {
      // Check if we have access to web search service
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`http://localhost:8080/api/search/unified?query=${encodeURIComponent(query + ' stock symbol ticker')}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      }).catch(() => null)
      
      clearTimeout(timeoutId)
      
      if (response && response.ok) {
        const searchData = await response.json()
        const symbols = this.extractSymbolsFromWebSearch(searchData, query)
        
        // Validate found symbols by attempting to get quotes
        const validatedResults: { symbol: string; name: string }[] = []
        for (const symbol of symbols) {
          try {
            const quote = await this.getQuote(symbol)
            validatedResults.push({ symbol: quote.symbol, name: quote.name || quote.symbol })
            if (validatedResults.length >= 3) break // Limit to top 3 results
          } catch (error) {
            logger.debug(`Symbol validation failed for ${symbol}`)
          }
        }
        
        return validatedResults
      }
    } catch (error) {
      logger.debug(`Web search service not available:`, (error as Error).message)
    }
    
    return []
  }
  
  private extractSymbolsFromWebSearch(searchData: any, originalQuery: string): string[] {
    const symbols: string[] = []
    
    if (searchData?.results && Array.isArray(searchData.results)) {
      for (const result of searchData.results) {
        if (!result || typeof result !== 'object') continue
        
        const title = result.title || ''
        const snippet = result.snippet || ''
        const content = `${title} ${snippet}`.toLowerCase()
        
        // Look for ticker symbols in the content
        const tickerPatterns = [
          /ticker:\s*([A-Z]{2,5})/gi,
          /symbol:\s*([A-Z]{2,5})/gi,
          /\(([A-Z]{2,5})\)/g,
          /\b([A-Z]{2,5})\b/g
        ]
        
        for (const pattern of tickerPatterns) {
          const matches = content.matchAll(pattern)
          for (const match of matches) {
            if (match[1]) {
              const symbol = match[1].toUpperCase()
              if (symbol.length >= 2 && symbol.length <= 5 && !symbols.includes(symbol)) {
                symbols.push(symbol)
              }
            }
          }
        }
      }
    }
    
    return symbols.slice(0, 10) // Return top 10 potential symbols
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