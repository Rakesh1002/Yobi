import { AlphaVantageProvider } from '../providers/AlphaVantageProvider'
import { YahooFinanceProvider } from '../providers/YahooFinanceProvider'
import { YFinanceProvider } from '../providers/YFinanceProvider'
import { FinnhubProvider } from '../providers/FinnhubProvider'
import { DatabaseManager } from './DatabaseManager'
import { TechnicalAnalysisService } from './TechnicalAnalysisService'
import { instrumentDiscoveryService } from './InstrumentDiscoveryService'
import { createLogger } from '../utils/logger'

const logger = createLogger('data-collection')

// Exchange-specific symbol lists for comprehensive market coverage (~1000 instruments)
const NASDAQ_SYMBOLS = [
  // FAANG + Tech Giants
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX',
  'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'QCOM', 'IBM', 'PYPL', 'CSCO', 'AVGO',
  
  // S&P 500 Large Caps - Financial
  'BRK-B', 'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'SCHW', 'BLK', 'SPGI',
  'ICE', 'COF', 'USB', 'TFC', 'PNC', 'CME', 'AON', 'MMC', 'AJG', 'CB', 'TRV',
  'ALL', 'PGR', 'MET', 'PRU', 'AIG', 'AFL', 'HIG', 'L', 'CINF', 'WRB', 'RLI',
  
  // Healthcare & Pharma
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN', 'GILD',
  'MDT', 'CVS', 'CI', 'ANTM', 'HUM', 'CNC', 'MOH', 'ELV', 'LLY', 'NVO', 'REGN',
  'VRTX', 'ISRG', 'ZTS', 'DXCM', 'BIIB', 'ILMN', 'MRNA', 'BNTX', 'PFE',
  
  // Consumer & Retail
  'WMT', 'HD', 'PG', 'KO', 'PEP', 'COST', 'NKE', 'SBUX', 'MCD', 'TGT', 'LOW',
  'DIS', 'CMCSA', 'VZ', 'T', 'CHTR', 'NFLX', 'ROKU', 'SPOT', 'UBER', 'LYFT',
  'AMZN', 'EBAY', 'ETSY', 'W', 'CHWY', 'PETS', 'CHEGG', 'LULU', 'GPS', 'ANF',
  
  // Energy & Utilities
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PSX', 'VLO', 'MPC', 'OXY', 'BKR', 'HAL',
  'NEE', 'SO', 'DUK', 'AEP', 'EXC', 'XEL', 'ES', 'ED', 'AWK', 'ATO', 'CMS',
  
  // Industrial & Manufacturing
  'CAT', 'HON', 'UPS', 'RTX', 'LMT', 'NOC', 'GD', 'BA', 'MMM', 'DE', 'EMR',
  'ITW', 'ETN', 'PH', 'CMI', 'ROK', 'DOV', 'FDX', 'UNP', 'CSX', 'NSC',
  
  // Materials & Chemicals
  'LIN', 'APD', 'ECL', 'DD', 'DOW', 'PPG', 'SHW', 'FCX', 'NEM', 'GOLD', 'AEM',
  'CF', 'FMC', 'ALB', 'CE', 'VMC', 'MLM', 'NUE', 'STLD', 'X', 'CLF',
  
  // Technology - Additional
  'AMAT', 'LRCX', 'KLAC', 'MCHP', 'ADI', 'TXN', 'MU', 'WDC', 'STX', 'SWKS',
  'MRVL', 'ON', 'MPWR', 'QRVO', 'XLNX', 'MXIM', 'CDNS', 'SNPS', 'ANSS', 'ADSK',
  'CRM', 'NOW', 'WDAY', 'VEEV', 'ZM', 'TEAM', 'OKTA', 'DOCU', 'CRWD', 'ZS',
  
  // Communication & Media
  'META', 'GOOGL', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'CHTR', 'TMUS', 'S',
  'FOXA', 'FOX', 'PARA', 'WBD', 'NWSA', 'NWS', 'NYT', 'GSAT', 'SIRI',
  
  // Real Estate & REITs
  'AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'EXR', 'AVB', 'EQR', 'WY', 'BXP', 'VTR',
  'WELL', 'ESS', 'MAA', 'UDR', 'CPT', 'FRT', 'REG', 'KIM', 'SPG', 'O', 'VICI',
  
  // Biotech & Life Sciences
  'GILD', 'AMGN', 'REGN', 'VRTX', 'BIIB', 'ILMN', 'MRNA', 'BNTX', 'MODERNA',
  'SGEN', 'BMRN', 'ALXN', 'INCY', 'TECH', 'ALGN', 'IDXX', 'IQV', 'A', 'WST',
  
  // Semiconductors
  'NVDA', 'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'ADI', 'MCHP', 'AMAT', 'LRCX',
  'KLAC', 'MU', 'WDC', 'STX', 'SWKS', 'MRVL', 'ON', 'MPWR', 'QRVO', 'XLNX',
  
  // Consumer Discretionary
  'AMZN', 'TSLA', 'HD', 'NKE', 'SBUX', 'MCD', 'LOW', 'TJX', 'BKNG', 'ABNB',
  'CMG', 'ORLY', 'AZO', 'ULTA', 'BBY', 'DECK', 'LULU', 'RH', 'TPG', 'MAR',
  
  // Software & Cloud
  'MSFT', 'ORCL', 'CRM', 'ADBE', 'NOW', 'INTU', 'WDAY', 'VEEV', 'ZM', 'TEAM',
  'OKTA', 'DOCU', 'CRWD', 'ZS', 'SNOW', 'DDOG', 'NET', 'ESTC', 'SPLK', 'TWLO',
  
  // E-commerce & Digital
  'AMZN', 'EBAY', 'ETSY', 'W', 'CHWY', 'SHOP', 'SQ', 'PYPL', 'V', 'MA',
  'FISV', 'FIS', 'GPN', 'WU', 'WEX', 'FLWS', 'GRUB', 'DASH', 'UBER', 'LYFT',
  
  // Clean Energy & EV
  'TSLA', 'ENPH', 'SEDG', 'FSLR', 'SPWR', 'RUN', 'PLUG', 'FCEL', 'BE', 'QS',
  'LCID', 'RIVN', 'NIO', 'XPEV', 'LI', 'CHPT', 'EVGO', 'BLNK', 'SBE', 'HYLN',
  
  // Gaming & Entertainment
  'NFLX', 'DIS', 'EA', 'ATVI', 'TTWO', 'RBLX', 'U', 'ZNGA', 'DKNG', 'PENN',
  'MGM', 'LVS', 'WYNN', 'CZR', 'BYD', 'CNK', 'AMC', 'IMAX', 'WWE', 'ROKU',
  
  // ETFs & Index Funds
  'SPY', 'QQQ', 'IWM', 'VTI', 'VEA', 'VWO', 'BND', 'TLT', 'GLD', 'SLV',
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLB',
  'IYR', 'IBB', 'SMH', 'XBI', 'XME', 'XHB', 'XRT', 'ITB', 'KRE', 'KIE',
  
  // Mid-Cap Growth
  'ROKU', 'TWLO', 'SHOP', 'SQ', 'ZM', 'DOCU', 'CRWD', 'OKTA', 'DDOG', 'NET',
  'SNOW', 'MDB', 'ESTC', 'SPLK', 'VEEV', 'WDAY', 'NOW', 'ZS', 'TEAM', 'GTLB',
  
  // Small-Cap & Emerging
  'UPST', 'AFRM', 'HOOD', 'COIN', 'RBLX', 'ABNB', 'DASH', 'UBER', 'LYFT', 'SPOT',
  'PINS', 'SNAP', 'TWTR', 'YELP', 'GRUB', 'MTCH', 'BMBL', 'IAC', 'TRIP', 'EXPE'
]

const NSE_SYMBOLS = [
  // Nifty 50 - Top Indian stocks
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
  'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'HCLTECH',
  'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'ONGC', 'TATAMOTORS', 'SUNPHARMA',
  'NTPC', 'POWERGRID', 'M&M', 'TECHM', 'TITAN', 'COALINDIA', 'INDUSINDBK', 'ADANIPORTS',
  'BAJAJFINSV', 'HDFCLIFE', 'SBILIFE', 'BRITANNIA', 'DIVISLAB', 'DRREDDY', 'EICHERMOT',
  'BAJAJ-AUTO', 'HEROMOTOCO', 'HINDALCO', 'CIPLA', 'GRASIM', 'TATASTEEL', 'UPL',
  'JSWSTEEL', 'APOLLOHOSP', 'TATACONSUM', 'ADANIENT', 'LTIM', 'BPCL', 'INDIGO',
  
  // Nifty Next 50 & Large Caps
  'ADANIGREEN', 'ADANITRANS', 'AMBUJACEM', 'BANDHANBNK', 'BERGEPAINT', 'BIOCON',
  'BOSCHLTD', 'CANFINHOME', 'CHOLAFIN', 'COLPAL', 'CONCOR', 'COFORGE', 'DABUR',
  'DALBHARAT', 'DEEPAKNTR', 'DELTACORP', 'DIXON', 'DLF', 'GAIL', 'GODREJCP',
  'GODREJPROP', 'HAVELLS', 'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'INDUSTOWER',
  'IOC', 'IRCTC', 'JINDALSTEL', 'JUBLFOOD', 'LICHSGFIN', 'LUPIN', 'MARICO',
  'MINDTREE', 'MUTHOOTFIN', 'NMDC', 'NYKAA', 'OBEROIRLTY', 'OFSS', 'PAGEIND',
  'PETRONET', 'PIDILITIND', 'PIIND', 'PNB', 'POLICYBZR', 'PVR', 'RBLBANK',
  'SAIL', 'SHREECEM', 'SIEMENS', 'SRF', 'TORNTPHARM', 'TRENT', 'TVSMOTOR',
  'VOLTAS', 'ZEEL', 'ZOMATO', 'MCDOWELL-N',
  
  // Banking & Financial Services - Extended
  'FEDERALBNK', 'BANKBARODA', 'CANBK', 'UNIONBANK', 'YESBANK', 'AUBANK',
  'EQUITASBNK', 'INDIANB', 'IDBI', 'IOBB', 'PSB', 'UCO', 'CENTRALBK',
  'MANAPPURAM', 'BAJAJHLDNG', 'SHRIRAMFIN', 'M&MFIN', 'SRTRANSFIN', 'PNBHOUSING',
  'LICHSGFIN', 'CANFINHOME', 'REPCO', 'GRUH', 'DHFL', 'HUDCO', 'IIFL',
  'CAPLIPOINT', 'CHOLAFIN', 'MUTHOOTFIN', 'EDELWEISS', 'MOTILALOFS', 'ANGELONE',
  
  // Information Technology - Extended
  'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'MINDTREE', 'COFORGE',
  'MPHASIS', 'PERSISTENT', 'LTTS', 'OFSS', 'HEXAWARE', 'CYIENT', 'SONACOMS',
  'RATEGAIN', 'INTELLECT', 'RAMCOCEM', 'TATAELXSI', 'KPITTECH', 'ZENSAR',
  'NIITTECH', '3IINFOTECH', 'ONMOBILE', 'SAKSOFT', 'MASTEK', 'BIRLASOFT',
  'POLYCAB', 'DATAMATICS', 'CMSINFO', 'NELCO', 'SUBEXLTD', 'TAKE', 'ECLERX',
  
  // Pharmaceuticals & Healthcare
  'SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'LUPIN', 'BIOCON', 'CADILAHC',
  'AUROPHARMA', 'TORNTPHARM', 'GLENMARK', 'ALKEM', 'LALPATHLAB', 'METROPOLIS',
  'APOLLOHOSP', 'FORTIS', 'MAXHEALTH', 'NARAYANAHEM', 'RAINBOWHTN', 'STAR',
  'PFIZER', 'ABBOTINDIA', 'GLAXO', 'SANOFI', 'NOVARTIS', 'MANKIND', 'ZYDUSWELL',
  'GRANULES', 'REDDY', 'STRIDES', 'NATCOPHAR', 'AJANTAPHARMA', 'IPCALAB',
  'IOLCP', 'WOCKPHARMA', 'JBCHEM', 'CAPLIPOINT', 'BLISSGVS', 'DRREDDYS',
  
  // Oil & Gas - Extended
  'RELIANCE', 'ONGC', 'IOC', 'BPCL', 'HINDPETRO', 'GAIL', 'OIL', 'MGL',
  'IGL', 'PETRONET', 'GSPL', 'ATGL', 'AEGISCHEM', 'DEEPAKNTR', 'GNFC',
  'NOCIL', 'AARTI', 'BASF', 'GHCL', 'AKZOINDIA', 'KANSAINER', 'TATACHEM',
  'BALRAMCHIN', 'DCBBANK', 'FINOLEXIND', 'PIDILITIND', 'SRF', 'CHEMANBAIN',
  
  // Automobiles & Auto Components
  'MARUTI', 'TATAMOTORS', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT',
  'TVSMOTOR', 'ASHOKLEY', 'BALKRISIND', 'MRF', 'APOLLOTYRE', 'CEAT',
  'ESCORTS', 'FORCE', 'MAHINDCIE', 'MOTHERSUMI', 'BOSCHLTD', 'ENDURANCE',
  'RAMKRISHNA', 'SUNDRMFAST', 'MINDACORP', 'SUPRAJIT', 'GABRIEL', 'WABCOINDIA',
  'BHARATFORG', 'AMTEKAUTO', 'FIEM', 'LUMAX', 'VARROC', 'SUBROS', 'SETCO',
  
  // Consumer Goods & FMCG
  'HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP',
  'COLPAL', 'EMAMILTD', 'BAJAJCON', 'VBL', 'RADICO', 'UBL', 'JUBLFOOD',
  'TATACONSUM', 'PGHH', 'GILLETTE', 'HONAUT', 'PIDILITE', 'JYOTHYLAB',
  'AVANTIFEED', 'PATANJALI', 'RSYSTEMS', 'RELAXO', 'BATA', 'VIPIND',
  'AHLEAST', 'DIXON', 'WHIRLPOOL', 'BLUESTAR', 'AMBER', 'VGUARD',
  
  // Metals & Mining
  'TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'COALINDIA', 'NMDC', 'SAIL',
  'JINDALSTEL', 'RATNAMANI', 'WELCORP', 'MOIL', 'MANGALAM', 'JSWENERGY',
  'ADANIENT', 'ADANIPORTS', 'JSPL', 'WELSPUNIND', 'HINDZINC', 'NATIONALUM',
  'BALRAMCHIN', 'JSLHISAR', 'KALYANI', 'MAITHANALL', 'RAMCO', 'GRAPHITE',
  'KECL', 'ADANIPOWER', 'RPOWER', 'JPPOWER', 'SUZLON', 'ORIENTREF',
  
  // Cement & Construction
  'ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'RAMCOCEM', 'HEIDELBERG',
  'JKCEMENT', 'ORIENTCEM', 'PRISMCEM', 'BANGALOREPO', 'DLF', 'OBEROIRLTY',
  'PRESTIGE', 'GODREJPROP', 'BRIGADE', 'SOBHA', 'MAHLIFE', 'KOLTEPATIL',
  'PHOENIXLTD', 'UNITECH', 'ANANTRAJ', 'OMAXE', 'IBREALEST', 'MAHINDCIE',
  'PNB', 'ADANIGREEN', 'ADANITRANS', 'L&TFH', 'IRCON', 'NBCC', 'HUDCO',
  
  // Power & Utilities
  'NTPC', 'POWERGRID', 'ADANIGREEN', 'ADANITRANS', 'TATAPOWER', 'NHPC',
  'SJVN', 'PFC', 'RECLTD', 'IREDA', 'THERMAX', 'BHEL', 'CESC', 'TORNTPOWER',
  'JSWENERGY', 'ADANIPOWER', 'RPOWER', 'JPPOWER', 'SUZLON', 'INOXWIND',
  'ORIENTREF', 'RELINFRA', 'GMRINFRA', 'IPCALAB', 'KEC', 'KECL', 'CRISIL',
  
  // Telecommunications
  'BHARTIARTL', 'INDUS', 'GTPL', 'TEJAS', 'HFCL', 'RAILTEL', 'ITI', 'VINDHYATEL',
  'STERLITE', 'TTML', 'RCOM', 'IDEA', 'TATACOMM', 'SITI', 'NXTDIGITAL',
  
  // Retail & E-commerce
  'ZOMATO', 'NYKAA', 'POLICYBZR', 'PAYTM', 'TRENT', 'ADITYADAYA', 'WESTLIFE',
  'JUBILANT', 'SPENCERS', 'SHOPERSTOP', 'FRETAIL', 'AVENUE', 'V2RETAIL',
  'VMART', 'RTNPOWER', 'ADANIGAS', 'MAHANAGAR', 'GUJGAS', 'INDHOTEL',
  
  // Airlines & Transportation
  'INDIGO', 'SPICEJET', 'IRCTC', 'CONCOR', 'CONTAINR', 'GESHIP', 'SGLCORP',
  'BLUEDARTTRANSPORT', 'MAHLOG', 'SHIPIND', 'ESABINDIA', 'TIINDIA', 'VTL',
  
  // Entertainment & Media
  'ZEEL', 'SUNTV', 'PVRINOX', 'INOXLEISUR', 'EROS', 'BALAJITELE', 'TIPS',
  'NETWORK18', 'TV18BRDCST', 'JAGRAN', 'DBCORP', 'NAVNETEDUL', 'SAREGAMA',
  
  // Textiles & Apparel
  'GRASIM', 'VARDHMAN', 'RSWM', 'TRIDENT', 'WELSPUN', 'PAGEIND', 'RAYMOND',
  'ARVIND', 'VIPIND', 'RELAXO', 'BATA', 'DOLLAR', 'SIYARAM', 'SPANDANA',
  
  // Chemicals & Fertilizers
  'UPL', 'SRF', 'PIDILITIND', 'DEEPAKNTR', 'TATACHEM', 'BASF', 'AKZOINDIA',
  'NOCIL', 'ALKYLAMINE', 'CLEAN', 'CAMS', 'AARTI', 'GHCL', 'GNFC',
  'CHAMBAL', 'GSFC', 'NFL', 'RCF', 'FACT', 'MADRASFERT', 'MANGFERT',
  
  // Miscellaneous & Emerging
  'DIXON', 'VOLTAS', 'BLUEDART', 'CONCOR', 'ADANIGAS', 'MAHANAGAR', 'GUJGAS',
  'ASTRAL', 'SYMPHONY', 'CAMS', 'CDSL', 'MCDOWELL-N', 'RADICO', 'UBL',
  'SOBHA', 'PRESTIGE', 'BRIGADE', 'GODREJPROP', 'DLF', 'OBEROIRLTY', 'MAHLIFE'
]

// Combined default symbols from both exchanges
const DEFAULT_SYMBOLS = [...NASDAQ_SYMBOLS, ...NSE_SYMBOLS]

export class DataCollectionService {
  private alphaVantage: AlphaVantageProvider
  private yahooFinance: YahooFinanceProvider
  private yfinance: YFinanceProvider
  private finnhub: FinnhubProvider
  private database: DatabaseManager
  private technicalAnalysis: TechnicalAnalysisService

  constructor() {
    this.alphaVantage = new AlphaVantageProvider()
    this.yahooFinance = new YahooFinanceProvider()
    this.yfinance = new YFinanceProvider()
    this.finnhub = new FinnhubProvider()
    this.database = new DatabaseManager()
    this.technicalAnalysis = new TechnicalAnalysisService()
  }

  // Collect quotes for tracked instruments (dynamic)
  async collectQuotes(symbols?: string[]): Promise<void> {
    try {
      // If no symbols provided, get tracked instruments
      if (!symbols) {
        const trackedInstruments = await instrumentDiscoveryService.getTrackedInstruments()
        symbols = trackedInstruments.map(i => i.symbol)
        logger.info(`Collecting quotes for ${symbols.length} dynamically tracked instruments`)
      } else {
        logger.info(`Collecting quotes for ${symbols.length} specified symbols`)
      }

      if (symbols.length === 0) {
        logger.warn('No symbols to collect quotes for')
        return
      }
      
      // Process symbols in batches
      const batchSize = 10
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize)
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}: ${batch.join(', ')}`)
        
        try {
          await this.processBatch(batch)
        } catch (error) {
          logger.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error)
        }
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      logger.info(`Quote collection completed for ${symbols.length} symbols`)
    } catch (error) {
      logger.error('Quote collection failed:', error)
      throw error
    }
  }

  // Collect quotes from NASDAQ exchange only
  async collectNasdaqQuotes(): Promise<void> {
    logger.info(`Collecting quotes for ${NASDAQ_SYMBOLS.length} NASDAQ symbols`)
    return this.collectQuotes(NASDAQ_SYMBOLS)
  }

  // Collect quotes from NSE exchange only  
  async collectNseQuotes(): Promise<void> {
    logger.info(`Collecting quotes for ${NSE_SYMBOLS.length} NSE symbols`)
    return this.collectQuotes(NSE_SYMBOLS)
  }

  // Collect quotes from both exchanges
  async collectAllExchangeQuotes(): Promise<void> {
    logger.info('Collecting quotes from both NASDAQ and NSE exchanges')
    
    // Collect NASDAQ first
    await this.collectNasdaqQuotes()
    
    // Small delay between exchanges
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Then collect NSE
    await this.collectNseQuotes()
    
    logger.info('Completed quote collection for both exchanges')
  }

  // Collect quotes based on market hours (smart collection)
  async collectActiveMarketQuotes(): Promise<void> {
    const now = new Date()
    
    // Check US market hours (Eastern Time)
    const isUSMarketOpen = this.isUSMarketHours()
    
    // Check Indian market hours (IST)
    const isIndianMarketOpen = this.isIndianMarketHours()
    
    const promises: Promise<void>[] = []
    
    if (isUSMarketOpen) {
      logger.info('US market is open - collecting NASDAQ quotes')
      promises.push(this.collectNasdaqQuotes())
    }
    
    if (isIndianMarketOpen) {
      logger.info('Indian market is open - collecting NSE quotes')
      promises.push(this.collectNseQuotes())
    }
    
    if (promises.length === 0) {
      logger.info('No markets are currently open')
      return
    }
    
    // Collect from all active markets in parallel
    await Promise.all(promises)
    logger.info(`Completed collection from ${promises.length} active market(s)`)
  }

  private isUSMarketHours(): boolean {
    const now = new Date()
    const easternTimeString = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    const weekdayMatch = easternTimeString.match(/^(Mon|Tue|Wed|Thu|Fri)/)
    const timeMatch = easternTimeString.match(/(\d{2}):(\d{2})/)
    
    if (!weekdayMatch || !timeMatch || !timeMatch[1] || !timeMatch[2]) return false
    
    const hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    const timeInMinutes = hour * 60 + minute
    
    const marketOpen = 9 * 60 + 30  // 9:30 AM
    const marketClose = 16 * 60     // 4:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes <= marketClose
  }

  private isIndianMarketHours(): boolean {
    const now = new Date()
    const istTimeString = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    const weekdayMatch = istTimeString.match(/^(Mon|Tue|Wed|Thu|Fri)/)
    const timeMatch = istTimeString.match(/(\d{2}):(\d{2})/)
    
    if (!weekdayMatch || !timeMatch || !timeMatch[1] || !timeMatch[2]) return false
    
    const hour = parseInt(timeMatch[1], 10)
    const minute = parseInt(timeMatch[2], 10)
    const timeInMinutes = hour * 60 + minute
    
    const marketOpen = 9 * 60       // 9:00 AM
    const marketClose = 16 * 60     // 4:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes <= marketClose
  }

  async collectHistoricalData(symbols: string[] = DEFAULT_SYMBOLS, period: string = '1y'): Promise<void> {
    logger.info(`Starting historical data collection for ${symbols.length} symbols`)
    
    for (const symbol of symbols) {
      try {
        logger.info(`Collecting historical data for ${symbol}`)
        
        // Try yfinance first (free and reliable)
        let historicalData
        try {
          historicalData = await this.yfinance.getHistoricalData(symbol, period)
        } catch (error) {
          logger.warn(`yfinance failed for ${symbol}, trying Yahoo Finance`)
          try {
            historicalData = await this.yahooFinance.getHistoricalData(symbol, period)
          } catch (error2) {
            logger.warn(`Yahoo Finance failed for ${symbol}, trying Alpha Vantage`)
            historicalData = await this.alphaVantage.getHistoricalData(symbol, period)
          }
        }
        
        // Store in database
        if (historicalData && historicalData.data.length > 0) {
          await this.database.storeHistoricalData(symbol, historicalData.data)
          logger.info(`Stored ${historicalData.data.length} historical data points for ${symbol}`)
        }
        
        // Rate limiting
        await this.delay(1000) // 1 second delay between symbols
        
      } catch (error) {
        logger.error(`Historical data collection failed for ${symbol}:`, error)
      }
    }
    
    logger.info('Historical data collection completed')
  }

  async collectFundamentalData(symbols: string[] = DEFAULT_SYMBOLS): Promise<void> {
    logger.info(`Starting fundamental data collection for ${symbols.length} symbols`)
    
    for (const symbol of symbols) {
      try {
        logger.info(`Collecting fundamental data for ${symbol}`)
        
        // Use Alpha Vantage for fundamental data
        const fundamentalData = await this.alphaVantage.getFundamentalData(symbol)
        
        if (fundamentalData) {
          await this.database.storeFundamentalData(symbol, fundamentalData)
          logger.info(`Stored fundamental data for ${symbol}`)
        }
        
        // Rate limiting (Alpha Vantage has strict limits)
        await this.delay(12000) // 12 seconds between calls (5 calls per minute)
        
      } catch (error) {
        logger.error(`Fundamental data collection failed for ${symbol}:`, error)
      }
    }
    
    logger.info('Fundamental data collection completed')
  }

  /**
   * Calculate technical indicators for collected symbols
   */
  async calculateTechnicalIndicators(symbols: string[] = DEFAULT_SYMBOLS): Promise<void> {
    logger.info(`Starting technical analysis for ${symbols.length} symbols`)
    
    try {
      const results = await this.technicalAnalysis.calculateIndicatorsForSymbols(symbols)
      
      logger.info(`Calculated technical indicators for ${results.size} symbols`)
      
      // Log some results for verification
      for (const [symbol, indicators] of results) {
        logger.info(`${symbol}: RSI=${indicators.rsi?.toFixed(2)}, Signal=${indicators.signal}, Strength=${indicators.signalStrength.toFixed(2)}`)
      }
      
    } catch (error) {
      logger.error('Technical analysis failed:', error)
      throw error
    }
  }

  /**
   * Calculate technical indicators for a single symbol
   */
  async calculateIndicatorsForSymbol(symbol: string): Promise<void> {
    try {
      logger.info(`Calculating technical indicators for ${symbol}`)
      
      const indicators = await this.technicalAnalysis.calculateIndicators(symbol)
      
      if (indicators) {
        logger.info(`${symbol}: RSI=${indicators.rsi?.toFixed(2)}, Signal=${indicators.signal}, Strength=${indicators.signalStrength.toFixed(2)}`)
      } else {
        logger.warn(`No technical indicators calculated for ${symbol}`)
      }
      
    } catch (error) {
      logger.error(`Technical analysis failed for ${symbol}:`, error)
    }
  }

  /**
   * Complete data collection workflow: quotes + fundamentals + technical analysis
   */
  async collectCompleteDataset(symbols?: string[]): Promise<void> {
    try {
      // If no symbols provided, get tracked instruments
      if (!symbols) {
        const trackedInstruments = await instrumentDiscoveryService.getTrackedInstruments()
        symbols = trackedInstruments.map(i => i.symbol)
      }

      logger.info(`Starting complete data collection for ${symbols.length} symbols`)
      
      // Step 1: Collect market quotes
      await this.collectQuotes(symbols)
      
      // Step 2: Calculate technical indicators (after market data is available)
      await this.calculateTechnicalIndicators(symbols)
      
      // Step 3: Collect fundamental data (rate limited)
      if (process.env.ALPHA_VANTAGE_API_KEY) {
        logger.info('Starting fundamental data collection...')
        await this.collectFundamentalData(symbols.slice(0, 10)) // Limit to 10 symbols due to API limits
      } else {
        logger.warn('Skipping fundamental data collection - no Alpha Vantage API key')
      }
      
      logger.info('Complete data collection workflow finished')
      
    } catch (error) {
      logger.error('Complete data collection failed:', error)
      throw error
    }
  }

  /**
   * Discover and add a new instrument when user searches for it
   */
  async discoverAndTrackInstrument(symbol: string): Promise<void> {
    try {
      logger.info(`Discovering new instrument: ${symbol}`)
      
      // Use the discovery service
      const instrumentInfo = await instrumentDiscoveryService.discoverInstrument(symbol)
      
      if (instrumentInfo) {
        logger.info(`Successfully discovered ${symbol}, triggering initial data collection`)
        
        // Collect initial data for the new instrument
        await this.collectQuotes([symbol])
        
        // Trigger fundamental data collection if API available
        if (process.env.ALPHA_VANTAGE_API_KEY) {
          await this.collectFundamentalData([symbol])
        }
      } else {
        logger.warn(`Could not discover instrument: ${symbol}`)
      }
      
    } catch (error) {
      logger.error(`Failed to discover and track instrument ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Maintain top 1000 instruments by volume and user interest
   */
  async maintainTopInstruments(): Promise<void> {
    try {
      logger.info('Maintaining top instruments list')
      
      // Step 1: Discover trending instruments
      const trending = await instrumentDiscoveryService.discoverTrendingInstruments()
      
      // Step 2: Add trending instruments to tracking
      for (const symbol of trending) {
        try {
          await instrumentDiscoveryService.discoverInstrument(symbol)
        } catch (error) {
          logger.warn(`Failed to add trending instrument ${symbol}:`, error)
        }
      }
      
      // Step 3: Update priorities based on volume and usage
      await instrumentDiscoveryService.updateInstrumentPriorities()
      
      // Step 4: Clean up low-priority instruments to maintain limit
      await instrumentDiscoveryService.maintainInstrumentLimit()
      
      logger.info('Completed top instruments maintenance')
      
    } catch (error) {
      logger.error('Failed to maintain top instruments:', error)
    }
  }

  /**
   * Collect quotes for top volume instruments
   */
  async collectTopVolumeQuotes(): Promise<void> {
    try {
      const topByVolume = await instrumentDiscoveryService.getTopInstrumentsByVolume(200)
      
      if (topByVolume.length > 0) {
        logger.info(`Collecting quotes for top ${topByVolume.length} instruments by volume`)
        await this.collectQuotes(topByVolume)
      }
      
    } catch (error) {
      logger.error('Failed to collect top volume quotes:', error)
    }
  }

  private async processBatch(symbols: string[]): Promise<void> {
    // Use bulk collection with yfinance for efficiency
    try {
      logger.info(`Using yfinance bulk collection for ${symbols.length} symbols`)
      const quotes = await this.yfinance.getMultipleQuotes(symbols)
      
      // Store successful quotes
      for (const quote of quotes) {
        if ('price' in quote && quote.price) {
          await this.database.storeQuote(quote.symbol, quote)
          logger.debug(`Stored quote for ${quote.symbol}: $${quote.price}`)
        }
      }
      
      // Check for failed symbols and retry with other providers
      const failedSymbols = symbols.filter(symbol => 
        !quotes.some(quote => quote.symbol === symbol && 'price' in quote)
      )
      
      if (failedSymbols.length > 0) {
        logger.info(`Retrying ${failedSymbols.length} failed symbols with fallback providers`)
        await this.retryFailedSymbols(failedSymbols)
      }
      
    } catch (error) {
      logger.error('yfinance bulk collection failed, falling back to individual requests:', error)
      await this.retryFailedSymbols(symbols)
    }
  }

  private async retryFailedSymbols(symbols: string[]): Promise<void> {
    const promises = symbols.map(async (symbol) => {
      try {
        let quote
        
        // Try providers in order of preference
        try {
          quote = await this.yfinance.getQuote(symbol)
        } catch (error) {
          logger.warn(`yfinance failed for ${symbol}, trying Yahoo Finance`)
          try {
            quote = await this.yahooFinance.getQuote(symbol)
          } catch (error2) {
            logger.warn(`Yahoo Finance failed for ${symbol}, trying Finnhub`)
            try {
              quote = await this.finnhub.getQuote(symbol)
            } catch (error3) {
              logger.warn(`Finnhub failed for ${symbol}, trying Alpha Vantage`)
              quote = await this.alphaVantage.getQuote(symbol)
            }
          }
        }
        
        if (quote) {
          await this.database.storeQuote(symbol, quote)
          logger.debug(`Stored quote for ${symbol}: $${quote.price}`)
        }
        
      } catch (error) {
        logger.error(`All providers failed for ${symbol}:`, error)
      }
    })
    
    await Promise.allSettled(promises)
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async getProviderStatus(): Promise<any> {
    return {
      yfinance: await this.yfinance.getServiceStatus(),
      alphaVantage: await this.alphaVantage.getStatus(),
      yahooFinance: await this.yahooFinance.getStatus(),
      finnhub: await this.finnhub.getStatus(),
      database: await this.database.getStatus()
    }
  }
} 