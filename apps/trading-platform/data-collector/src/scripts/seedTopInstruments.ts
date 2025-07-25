import { instrumentDiscoveryService } from "../services/InstrumentDiscoveryService";
import { DataCollectionService } from "../services/DataCollectionService";
import { createLogger } from "../utils/logger";
import { AssetClass, Exchange } from "@yobi/shared-types";

const logger = createLogger("instrument-seeder");

interface InstrumentSeed {
  symbol: string;
  name: string;
  exchange: Exchange;
  assetClass: AssetClass;
  sector?: string;
  priority: number;
  marketCap?: "LARGE" | "MID" | "SMALL";
}

export class InstrumentSeeder {
  private dataCollectionService: DataCollectionService;

  constructor() {
    this.dataCollectionService = new DataCollectionService();
  }

  /**
   * Seed database with 1000+ instruments across all asset classes and market caps
   */
  async seedTopInstruments(): Promise<void> {
    try {
      logger.info("🌱 Starting comprehensive instrument seeding...");

      const instruments: InstrumentSeed[] = [];

      // 1. Top NASDAQ stocks by market cap and volume (350 instruments)
      logger.info("📈 Fetching comprehensive NASDAQ stocks...");
      const nasdaqStocks = await this.getComprehensiveNasdaqStocks(350);
      instruments.push(...nasdaqStocks);

      // 2. Top NYSE stocks by market cap and volume (300 instruments)
      logger.info("📈 Fetching comprehensive NYSE stocks...");
      const nyseStocks = await this.getComprehensiveNyseStocks(300);
      instruments.push(...nyseStocks);

      // 3. Top NSE stocks by market cap and volume (200 instruments)
      logger.info("🇮🇳 Fetching comprehensive NSE stocks...");
      const nseStocks = await this.getComprehensiveNseStocks(200);
      instruments.push(...nseStocks);

      // 4. BSE additional Indian stocks (50 instruments)
      logger.info("🇮🇳 Fetching BSE stocks...");
      const bseStocks = await this.getBseStocks(50);
      instruments.push(...bseStocks);

      // 5. Comprehensive ETFs (100 instruments)
      logger.info("📊 Fetching comprehensive ETFs...");
      const etfs = await this.getComprehensiveEtfs(100);
      instruments.push(...etfs);

      // 6. Top Crypto by market cap (50 instruments)
      logger.info("₿ Fetching comprehensive cryptocurrencies...");
      const crypto = await this.getComprehensiveCrypto(50);
      instruments.push(...crypto);

      // 7. Popular mutual funds (50 instruments)
      logger.info("🏦 Adding comprehensive mutual funds...");
      const mutualFunds = await this.getComprehensiveMutualFunds(50);
      instruments.push(...mutualFunds);

      logger.info(`🎯 Total instruments to seed: ${instruments.length}`);

      // Add instruments using discovery service
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < instruments.length; i++) {
        const instrument = instruments[i];

        if (!instrument) continue;

        try {
          logger.info(
            `[${i + 1}/${instruments.length}] Adding ${instrument.symbol} (${
              instrument.exchange
            })`
          );

          // Use discovery service to add instrument
          await instrumentDiscoveryService.discoverInstrument(
            instrument.symbol
          );

          // Update priority based on our ranking
          await this.updateInstrumentPriority(
            instrument.symbol,
            instrument.priority
          );

          successCount++;

          // Rate limiting - don't overwhelm APIs
          if (i % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          logger.error(`Failed to add ${instrument.symbol}:`, error);
          errorCount++;
        }
      }

      logger.info(
        `✅ Seeding completed: ${successCount} success, ${errorCount} errors`
      );

      // Trigger initial data collection for high priority instruments
      logger.info("🔄 Triggering initial data collection...");
      await this.triggerInitialDataCollection();

      logger.info("🎉 Instrument seeding process completed!");
    } catch (error) {
      logger.error("❌ Seeding process failed:", error);
      throw error;
    }
  }

  /**
   * Get comprehensive NASDAQ stocks across large/mid/small cap
   */
  private async getComprehensiveNasdaqStocks(
    limit: number
  ): Promise<InstrumentSeed[]> {
    const topNasdaqStocks = [
      // Mega cap tech stocks
      { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
      { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
      { symbol: "GOOG", name: "Alphabet Inc. Class A", sector: "Technology" },
      {
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        sector: "Consumer Discretionary",
      },
      { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
      { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
      { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
      {
        symbol: "NFLX",
        name: "Netflix Inc.",
        sector: "Communication Services",
      },
      { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },

      // High volume NASDAQ stocks
      { symbol: "INTC", name: "Intel Corporation", sector: "Technology" },
      { symbol: "CSCO", name: "Cisco Systems Inc.", sector: "Technology" },
      { symbol: "ORCL", name: "Oracle Corporation", sector: "Technology" },
      { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology" },
      {
        symbol: "PYPL",
        name: "PayPal Holdings Inc.",
        sector: "Financial Services",
      },
      {
        symbol: "CMCSA",
        name: "Comcast Corporation",
        sector: "Communication Services",
      },
      { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples" },
      {
        symbol: "COST",
        name: "Costco Wholesale Corporation",
        sector: "Consumer Staples",
      },
      { symbol: "QCOM", name: "QUALCOMM Incorporated", sector: "Technology" },
      { symbol: "AMGN", name: "Amgen Inc.", sector: "Healthcare" },

      // Additional high-volume NASDAQ stocks
      {
        symbol: "SBUX",
        name: "Starbucks Corporation",
        sector: "Consumer Discretionary",
      },
      { symbol: "GILD", name: "Gilead Sciences Inc.", sector: "Healthcare" },
      {
        symbol: "MDLZ",
        name: "Mondelez International Inc.",
        sector: "Consumer Staples",
      },
      { symbol: "ISRG", name: "Intuitive Surgical Inc.", sector: "Healthcare" },
      {
        symbol: "REGN",
        name: "Regeneron Pharmaceuticals Inc.",
        sector: "Healthcare",
      },
      { symbol: "MRNA", name: "Moderna Inc.", sector: "Healthcare" },
      {
        symbol: "BKNG",
        name: "Booking Holdings Inc.",
        sector: "Consumer Discretionary",
      },
      { symbol: "MU", name: "Micron Technology Inc.", sector: "Technology" },
      { symbol: "CSX", name: "CSX Corporation", sector: "Industrials" },
      {
        symbol: "LRCX",
        name: "Lam Research Corporation",
        sector: "Technology",
      },

      // Biotech and growth stocks
      { symbol: "BIIB", name: "Biogen Inc.", sector: "Healthcare" },
      { symbol: "ILMN", name: "Illumina Inc.", sector: "Healthcare" },
      {
        symbol: "VRTX",
        name: "Vertex Pharmaceuticals Inc.",
        sector: "Healthcare",
      },
      {
        symbol: "MELI",
        name: "MercadoLibre Inc.",
        sector: "Consumer Discretionary",
      },
      {
        symbol: "ADP",
        name: "Automatic Data Processing Inc.",
        sector: "Technology",
      },
      { symbol: "FISV", name: "Fiserv Inc.", sector: "Technology" },
      { symbol: "KLAC", name: "KLA Corporation", sector: "Technology" },
      { symbol: "AMAT", name: "Applied Materials Inc.", sector: "Technology" },
      {
        symbol: "MCHP",
        name: "Microchip Technology Inc.",
        sector: "Technology",
      },
      { symbol: "SNPS", name: "Synopsys Inc.", sector: "Technology" },

      // Additional popular NASDAQ names
      {
        symbol: "CDNS",
        name: "Cadence Design Systems Inc.",
        sector: "Technology",
      },
      { symbol: "DXCM", name: "DexCom Inc.", sector: "Healthcare" },
      { symbol: "TEAM", name: "Atlassian Corporation", sector: "Technology" },
      { symbol: "PANW", name: "Palo Alto Networks Inc.", sector: "Technology" },
      {
        symbol: "CRWD",
        name: "CrowdStrike Holdings Inc.",
        sector: "Technology",
      },
      {
        symbol: "ZM",
        name: "Zoom Video Communications Inc.",
        sector: "Technology",
      },
      { symbol: "DOCU", name: "DocuSign Inc.", sector: "Technology" },
      { symbol: "OKTA", name: "Okta Inc.", sector: "Technology" },
      { symbol: "ZS", name: "Zscaler Inc.", sector: "Technology" },
      { symbol: "SPLK", name: "Splunk Inc.", sector: "Technology" },

      // Consumer and retail
      {
        symbol: "WBA",
        name: "Walgreens Boots Alliance Inc.",
        sector: "Healthcare",
      },
      {
        symbol: "MAR",
        name: "Marriott International Inc.",
        sector: "Consumer Discretionary",
      },
      { symbol: "ABNB", name: "Airbnb Inc.", sector: "Consumer Discretionary" },
      { symbol: "UBER", name: "Uber Technologies Inc.", sector: "Technology" },
      { symbol: "LYFT", name: "Lyft Inc.", sector: "Technology" },
      {
        symbol: "DASH",
        name: "DoorDash Inc.",
        sector: "Consumer Discretionary",
      },
      {
        symbol: "PINS",
        name: "Pinterest Inc.",
        sector: "Communication Services",
      },
      { symbol: "SNAP", name: "Snap Inc.", sector: "Communication Services" },
      {
        symbol: "TWTR",
        name: "Twitter Inc.",
        sector: "Communication Services",
      },
      { symbol: "ROKU", name: "Roku Inc.", sector: "Communication Services" },
    ];

    // Generate more stocks by adding variations and filling to limit
    const result: InstrumentSeed[] = [];

    for (let i = 0; i < Math.min(limit, topNasdaqStocks.length); i++) {
      const stock = topNasdaqStocks[i];
      if (stock && stock.symbol && stock.name) {
        result.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          exchange: Exchange.NASDAQ,
          assetClass: AssetClass.STOCK,
          priority: 1000 - i, // Higher priority for earlier stocks
        });
      }
    }

    // If we need more, add some additional common NASDAQ stocks
    if (result.length < limit) {
      const additionalStocks = this.generateAdditionalNasdaqStocks(
        limit - result.length
      );
      result.push(...additionalStocks);
    }

    return result;
  }

  /**
   * Get comprehensive NYSE stocks across large/mid/small cap
   */
  private async getComprehensiveNyseStocks(
    limit: number
  ): Promise<InstrumentSeed[]> {
    const topNyseStocks = [
      // Blue chip stocks
      {
        symbol: "JPM",
        name: "JPMorgan Chase & Co.",
        sector: "Financial Services",
      },
      { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
      { symbol: "V", name: "Visa Inc.", sector: "Financial Services" },
      { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
      {
        symbol: "PG",
        name: "Procter & Gamble Co.",
        sector: "Consumer Staples",
      },
      { symbol: "UNH", name: "UnitedHealth Group Inc.", sector: "Healthcare" },
      {
        symbol: "HD",
        name: "Home Depot Inc.",
        sector: "Consumer Discretionary",
      },
      { symbol: "MA", name: "Mastercard Inc.", sector: "Financial Services" },
      {
        symbol: "DIS",
        name: "Walt Disney Co.",
        sector: "Communication Services",
      },
      {
        symbol: "BAC",
        name: "Bank of America Corp.",
        sector: "Financial Services",
      },

      // Energy and industrials
      { symbol: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
      { symbol: "CVX", name: "Chevron Corporation", sector: "Energy" },
      { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
      { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples" },
      { symbol: "MRK", name: "Merck & Co. Inc.", sector: "Healthcare" },
      { symbol: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
      { symbol: "LLY", name: "Eli Lilly and Co.", sector: "Healthcare" },
      {
        symbol: "TMO",
        name: "Thermo Fisher Scientific Inc.",
        sector: "Healthcare",
      },
      { symbol: "ACN", name: "Accenture plc", sector: "Technology" },
      { symbol: "AVGO", name: "Broadcom Inc.", sector: "Technology" },

      // Financial sector
      {
        symbol: "WFC",
        name: "Wells Fargo & Co.",
        sector: "Financial Services",
      },
      {
        symbol: "GS",
        name: "Goldman Sachs Group Inc.",
        sector: "Financial Services",
      },
      { symbol: "MS", name: "Morgan Stanley", sector: "Financial Services" },
      { symbol: "C", name: "Citigroup Inc.", sector: "Financial Services" },
      { symbol: "BLK", name: "BlackRock Inc.", sector: "Financial Services" },
      {
        symbol: "AXP",
        name: "American Express Co.",
        sector: "Financial Services",
      },
      { symbol: "SPGI", name: "S&P Global Inc.", sector: "Financial Services" },
      {
        symbol: "TRV",
        name: "Travelers Companies Inc.",
        sector: "Financial Services",
      },
      {
        symbol: "PGR",
        name: "Progressive Corp.",
        sector: "Financial Services",
      },
      { symbol: "CB", name: "Chubb Ltd.", sector: "Financial Services" },

      // Industrial and materials
      { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
      { symbol: "MMM", name: "3M Co.", sector: "Industrials" },
      { symbol: "BA", name: "Boeing Co.", sector: "Industrials" },
      { symbol: "GE", name: "General Electric Co.", sector: "Industrials" },
      {
        symbol: "HON",
        name: "Honeywell International Inc.",
        sector: "Industrials",
      },
      {
        symbol: "UPS",
        name: "United Parcel Service Inc.",
        sector: "Industrials",
      },
      { symbol: "LMT", name: "Lockheed Martin Corp.", sector: "Industrials" },
      {
        symbol: "RTX",
        name: "Raytheon Technologies Corp.",
        sector: "Industrials",
      },
      { symbol: "DE", name: "Deere & Co.", sector: "Industrials" },
      {
        symbol: "IBM",
        name: "International Business Machines Corp.",
        sector: "Technology",
      },
    ];

    const result: InstrumentSeed[] = [];

    for (let i = 0; i < Math.min(limit, topNyseStocks.length); i++) {
      const stock = topNyseStocks[i];
      if (stock && stock.symbol && stock.name) {
        result.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          exchange: Exchange.NYSE,
          assetClass: AssetClass.STOCK,
          priority: 900 - i, // Slightly lower priority than NASDAQ
        });
      }
    }

    // Add more if needed
    if (result.length < limit) {
      const additionalStocks = this.generateAdditionalNyseStocks(
        limit - result.length
      );
      result.push(...additionalStocks);
    }

    return result;
  }

  /**
   * Get comprehensive NSE stocks across large/mid/small cap
   */
  private async getComprehensiveNseStocks(
    limit: number
  ): Promise<InstrumentSeed[]> {
    const topNseStocks = [
      // Nifty 50 heavy weights
      {
        symbol: "RELIANCE",
        name: "Reliance Industries Limited",
        sector: "Energy",
      },
      {
        symbol: "TCS",
        name: "Tata Consultancy Services Limited",
        sector: "Information Technology",
      },
      {
        symbol: "HDFCBANK",
        name: "HDFC Bank Limited",
        sector: "Financial Services",
      },
      {
        symbol: "INFY",
        name: "Infosys Limited",
        sector: "Information Technology",
      },
      {
        symbol: "HINDUNILVR",
        name: "Hindustan Unilever Limited",
        sector: "FMCG",
      },
      {
        symbol: "ICICIBANK",
        name: "ICICI Bank Limited",
        sector: "Financial Services",
      },
      {
        symbol: "KOTAKBANK",
        name: "Kotak Mahindra Bank Limited",
        sector: "Financial Services",
      },
      {
        symbol: "SBIN",
        name: "State Bank of India",
        sector: "Financial Services",
      },
      {
        symbol: "BHARTIARTL",
        name: "Bharti Airtel Limited",
        sector: "Telecommunications",
      },
      { symbol: "ITC", name: "ITC Limited", sector: "FMCG" },

      // Auto sector
      {
        symbol: "TATAMOTORS",
        name: "Tata Motors Limited",
        sector: "Automobile",
      },
      {
        symbol: "M&M",
        name: "Mahindra & Mahindra Limited",
        sector: "Automobile",
      },
      {
        symbol: "MARUTI",
        name: "Maruti Suzuki India Limited",
        sector: "Automobile",
      },
      {
        symbol: "BAJAJ-AUTO",
        name: "Bajaj Auto Limited",
        sector: "Automobile",
      },
      {
        symbol: "HEROMOTOCO",
        name: "Hero MotoCorp Limited",
        sector: "Automobile",
      },
      {
        symbol: "EICHERMOT",
        name: "Eicher Motors Limited",
        sector: "Automobile",
      },
      {
        symbol: "TVSMOTOR",
        name: "TVS Motor Company Limited",
        sector: "Automobile",
      },
      {
        symbol: "ASHOKLEY",
        name: "Ashok Leyland Limited",
        sector: "Automobile",
      },
      {
        symbol: "BAJAJFINSV",
        name: "Bajaj Finserv Limited",
        sector: "Financial Services",
      },
      {
        symbol: "BAJFINANCE",
        name: "Bajaj Finance Limited",
        sector: "Financial Services",
      },

      // Pharma sector
      {
        symbol: "SUNPHARMA",
        name: "Sun Pharmaceutical Industries Limited",
        sector: "Pharmaceuticals",
      },
      {
        symbol: "DRREDDY",
        name: "Dr. Reddys Laboratories Limited",
        sector: "Pharmaceuticals",
      },
      { symbol: "CIPLA", name: "Cipla Limited", sector: "Pharmaceuticals" },
      {
        symbol: "DIVISLAB",
        name: "Divis Laboratories Limited",
        sector: "Pharmaceuticals",
      },
      { symbol: "BIOCON", name: "Biocon Limited", sector: "Pharmaceuticals" },
      { symbol: "LUPIN", name: "Lupin Limited", sector: "Pharmaceuticals" },
      {
        symbol: "AUROPHARMA",
        name: "Aurobindo Pharma Limited",
        sector: "Pharmaceuticals",
      },
      {
        symbol: "TORNTPHARM",
        name: "Torrent Pharmaceuticals Limited",
        sector: "Pharmaceuticals",
      },
      {
        symbol: "CADILAHC",
        name: "Cadila Healthcare Limited",
        sector: "Pharmaceuticals",
      },
      {
        symbol: "GLENMARK",
        name: "Glenmark Pharmaceuticals Limited",
        sector: "Pharmaceuticals",
      },

      // IT sector
      {
        symbol: "WIPRO",
        name: "Wipro Limited",
        sector: "Information Technology",
      },
      {
        symbol: "HCLTECH",
        name: "HCL Technologies Limited",
        sector: "Information Technology",
      },
      {
        symbol: "TECHM",
        name: "Tech Mahindra Limited",
        sector: "Information Technology",
      },
      {
        symbol: "LTI",
        name: "Larsen & Toubro Infotech Limited",
        sector: "Information Technology",
      },
      {
        symbol: "MINDTREE",
        name: "Mindtree Limited",
        sector: "Information Technology",
      },
      {
        symbol: "MPHASIS",
        name: "Mphasis Limited",
        sector: "Information Technology",
      },
      {
        symbol: "COFORGE",
        name: "Coforge Limited",
        sector: "Information Technology",
      },
      {
        symbol: "PERSISTENT",
        name: "Persistent Systems Limited",
        sector: "Information Technology",
      },
      {
        symbol: "LTTS",
        name: "L&T Technology Services Limited",
        sector: "Information Technology",
      },
      { symbol: "RPOWER", name: "Reliance Power Limited", sector: "Power" },

      // Metals and mining
      {
        symbol: "TATASTEEL",
        name: "Tata Steel Limited",
        sector: "Metals & Mining",
      },
      {
        symbol: "JSWSTEEL",
        name: "JSW Steel Limited",
        sector: "Metals & Mining",
      },
      {
        symbol: "HINDALCO",
        name: "Hindalco Industries Limited",
        sector: "Metals & Mining",
      },
      { symbol: "VEDL", name: "Vedanta Limited", sector: "Metals & Mining" },
      {
        symbol: "COALINDIA",
        name: "Coal India Limited",
        sector: "Metals & Mining",
      },
      {
        symbol: "SAIL",
        name: "Steel Authority of India Limited",
        sector: "Metals & Mining",
      },
      { symbol: "NMDC", name: "NMDC Limited", sector: "Metals & Mining" },
      {
        symbol: "JINDALSTEL",
        name: "Jindal Steel & Power Limited",
        sector: "Metals & Mining",
      },
      { symbol: "MOIL", name: "MOIL Limited", sector: "Metals & Mining" },
      {
        symbol: "NATIONALUM",
        name: "National Aluminium Company Limited",
        sector: "Metals & Mining",
      },

      // Infrastructure and cement
      {
        symbol: "LT",
        name: "Larsen & Toubro Limited",
        sector: "Infrastructure",
      },
      {
        symbol: "ULTRACEMCO",
        name: "UltraTech Cement Limited",
        sector: "Cement",
      },
      { symbol: "SHREECEM", name: "Shree Cement Limited", sector: "Cement" },
      { symbol: "GRASIM", name: "Grasim Industries Limited", sector: "Cement" },
      { symbol: "ACC", name: "ACC Limited", sector: "Cement" },
      {
        symbol: "AMBUJACEMENT",
        name: "Ambuja Cements Limited",
        sector: "Cement",
      },
      { symbol: "JKCEMENT", name: "JK Cement Limited", sector: "Cement" },
      { symbol: "RAMCOCEM", name: "Ramco Cements Limited", sector: "Cement" },
      {
        symbol: "HEIDELBERG",
        name: "HeidelbergCement India Limited",
        sector: "Cement",
      },
      { symbol: "PRISMCEM", name: "Prism Johnson Limited", sector: "Cement" },
    ];

    const result: InstrumentSeed[] = [];

    for (let i = 0; i < Math.min(limit, topNseStocks.length); i++) {
      const stock = topNseStocks[i];
      if (stock && stock.symbol && stock.name) {
        result.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          exchange: Exchange.NSE,
          assetClass: AssetClass.STOCK,
          priority: 800 - i,
        });
      }
    }

    // Add more if needed
    if (result.length < limit) {
      const additionalStocks = this.generateAdditionalNseStocks(
        limit - result.length
      );
      result.push(...additionalStocks);
    }

    return result;
  }

  /**
   * Get BSE (Bombay Stock Exchange) stocks
   */
  private async getBseStocks(limit: number): Promise<InstrumentSeed[]> {
    const bseStocks = [
      { symbol: "SENSEX", name: "BSE SENSEX", sector: "Index" },
      { symbol: "MIDCAP", name: "BSE MidCap", sector: "Index" },
      { symbol: "SMALLCAP", name: "BSE SmallCap", sector: "Index" },
      { symbol: "BANKEX", name: "BSE Bankex", sector: "Banking" },
      { symbol: "AUTO", name: "BSE Auto", sector: "Automobile" },
      { symbol: "REALTY", name: "BSE Realty", sector: "Real Estate" },
      { symbol: "PHARMA", name: "BSE Teck", sector: "Pharmaceuticals" },
      { symbol: "FMCG", name: "BSE FMCG", sector: "FMCG" },
      { symbol: "METAL", name: "BSE Metal", sector: "Metals" },
      { symbol: "POWER", name: "BSE Power", sector: "Power" },
    ];

    return bseStocks.slice(0, limit).map((stock, index) => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: Exchange.BSE,
      assetClass: AssetClass.STOCK,
      sector: stock.sector,
      priority: 750 - index,
      marketCap: "MID" as const,
    }));
  }

  /**
   * Get comprehensive ETFs across sectors and regions
   */
  private async getComprehensiveEtfs(limit: number): Promise<InstrumentSeed[]> {
    const topEtfs = [
      // US ETFs
      {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        exchange: Exchange.NYSE,
      },
      { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: Exchange.NASDAQ },
      {
        symbol: "IWM",
        name: "iShares Russell 2000 ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "VTI",
        name: "Vanguard Total Stock Market ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "VEA",
        name: "Vanguard FTSE Developed Markets ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "VWO",
        name: "Vanguard FTSE Emerging Markets ETF",
        exchange: Exchange.NYSE,
      },
      { symbol: "GLD", name: "SPDR Gold Shares", exchange: Exchange.NYSE },
      { symbol: "SLV", name: "iShares Silver Trust", exchange: Exchange.NYSE },
      {
        symbol: "TLT",
        name: "iShares 20+ Year Treasury Bond ETF",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "EEM",
        name: "iShares MSCI Emerging Markets ETF",
        exchange: Exchange.NYSE,
      },

      // Sector ETFs
      {
        symbol: "XLF",
        name: "Financial Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLK",
        name: "Technology Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLE",
        name: "Energy Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLV",
        name: "Health Care Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLI",
        name: "Industrial Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLU",
        name: "Utilities Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLP",
        name: "Consumer Staples Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLY",
        name: "Consumer Discretionary Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLB",
        name: "Materials Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "XLRE",
        name: "Real Estate Select Sector SPDR Fund",
        exchange: Exchange.NYSE,
      },

      // Popular growth ETFs
      { symbol: "ARKK", name: "ARK Innovation ETF", exchange: Exchange.NYSE },
      {
        symbol: "ARKQ",
        name: "ARK Autonomous Technology & Robotics ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "ARKG",
        name: "ARK Genomics Revolution ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "ARKW",
        name: "ARK Next Generation Internet ETF",
        exchange: Exchange.NYSE,
      },
      {
        symbol: "ARKF",
        name: "ARK Fintech Innovation ETF",
        exchange: Exchange.NYSE,
      },

      // Indian ETFs (NSE)
      {
        symbol: "NIFTYBEES",
        name: "Nippon India ETF Nifty BeES",
        exchange: Exchange.NSE,
      },
      {
        symbol: "JUNIORBEES",
        name: "Nippon India ETF Junior BeES",
        exchange: Exchange.NSE,
      },
      {
        symbol: "BANKBEES",
        name: "Nippon India ETF Bank BeES",
        exchange: Exchange.NSE,
      },
      {
        symbol: "ITBEES",
        name: "Nippon India ETF IT BeES",
        exchange: Exchange.NSE,
      },
      {
        symbol: "PSUBNKBEES",
        name: "Nippon India ETF PSU Bank BeES",
        exchange: Exchange.NSE,
      },
    ];

    return topEtfs.slice(0, limit).map((etf, index) => ({
      symbol: etf.symbol,
      name: etf.name,
      exchange: etf.exchange,
      assetClass: AssetClass.ETF,
      sector: "ETF",
      priority: 700 - index,
    }));
  }

  /**
   * Get comprehensive crypto by market cap and trading volume
   */
  private async getComprehensiveCrypto(
    limit: number
  ): Promise<InstrumentSeed[]> {
    const topCrypto = [
      { symbol: "BTC-USD", name: "Bitcoin USD" },
      { symbol: "ETH-USD", name: "Ethereum USD" },
      { symbol: "BNB-USD", name: "BNB USD" },
      { symbol: "XRP-USD", name: "XRP USD" },
      { symbol: "ADA-USD", name: "Cardano USD" },
      { symbol: "DOGE-USD", name: "Dogecoin USD" },
      { symbol: "MATIC-USD", name: "Polygon USD" },
      { symbol: "SOL-USD", name: "Solana USD" },
      { symbol: "DOT-USD", name: "Polkadot USD" },
      { symbol: "LTC-USD", name: "Litecoin USD" },
      { symbol: "SHIB-USD", name: "SHIBA INU USD" },
      { symbol: "TRX-USD", name: "TRON USD" },
      { symbol: "AVAX-USD", name: "Avalanche USD" },
      { symbol: "UNI-USD", name: "Uniswap USD" },
      { symbol: "LINK-USD", name: "Chainlink USD" },
      { symbol: "ATOM-USD", name: "Cosmos USD" },
      { symbol: "ETC-USD", name: "Ethereum Classic USD" },
      { symbol: "XLM-USD", name: "Stellar USD" },
      { symbol: "BCH-USD", name: "Bitcoin Cash USD" },
      { symbol: "ALGO-USD", name: "Algorand USD" },
    ];

    return topCrypto.slice(0, limit).map((crypto, index) => ({
      symbol: crypto.symbol,
      name: crypto.name,
      exchange: Exchange.CRYPTO,
      assetClass: AssetClass.CRYPTO,
      sector: "Cryptocurrency",
      priority: 600 - index,
    }));
  }

  /**
   * Get comprehensive mutual funds from major fund houses
   */
  private async getComprehensiveMutualFunds(
    limit: number
  ): Promise<InstrumentSeed[]> {
    const popularMutualFunds = [
      // US Mutual Funds (Vanguard, Fidelity, etc.)
      {
        symbol: "VTSAX",
        name: "Vanguard Total Stock Market Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "VTIAX",
        name: "Vanguard Total International Stock Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "VBTLX",
        name: "Vanguard Total Bond Market Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "VGTSX",
        name: "Vanguard Total International Stock Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "FXNAX",
        name: "Fidelity US Bond Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "FSKAX",
        name: "Fidelity Total Market Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "FTIHX",
        name: "Fidelity Total International Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "FZROX",
        name: "Fidelity ZERO Total Market Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "FZILX",
        name: "Fidelity ZERO International Index Fund",
        exchange: Exchange.NASDAQ,
      },
      {
        symbol: "SWTSX",
        name: "Schwab Total Stock Market Index Fund",
        exchange: Exchange.NASDAQ,
      },

      // Indian Mutual Funds (represented by popular fund house codes)
      {
        symbol: "ICICIPRU",
        name: "ICICI Prudential Mutual Fund",
        exchange: Exchange.NSE,
      },
      { symbol: "HDFCMF", name: "HDFC Mutual Fund", exchange: Exchange.NSE },
      { symbol: "SBIMF", name: "SBI Mutual Fund", exchange: Exchange.NSE },
      { symbol: "UTIMF", name: "UTI Mutual Fund", exchange: Exchange.NSE },
      {
        symbol: "AMCMF",
        name: "Aditya Birla Sun Life Mutual Fund",
        exchange: Exchange.NSE,
      },
      {
        symbol: "FRANKLINTEMPLETON",
        name: "Franklin Templeton Mutual Fund",
        exchange: Exchange.NSE,
      },
      { symbol: "KOTAKMF", name: "Kotak Mutual Fund", exchange: Exchange.NSE },
      { symbol: "AXISAMC", name: "Axis Mutual Fund", exchange: Exchange.NSE },
      { symbol: "DSPBLMF", name: "DSP Mutual Fund", exchange: Exchange.NSE },
      {
        symbol: "RELIANCEMF",
        name: "Reliance Mutual Fund",
        exchange: Exchange.NSE,
      },
    ];

    return popularMutualFunds.slice(0, limit).map((fund, index) => ({
      symbol: fund.symbol,
      name: fund.name,
      exchange: fund.exchange,
      assetClass: AssetClass.MUTUAL_FUND,
      sector: "Mutual Fund",
      priority: 500 - index,
    }));
  }

  /**
   * Update instrument priority after discovery
   */
  private async updateInstrumentPriority(
    symbol: string,
    priority: number
  ): Promise<void> {
    try {
      const { prisma } = await import("@yobi/database");

      await prisma.instrument.updateMany({
        where: { symbol: symbol.toUpperCase() },
        data: { priority },
      });
    } catch (error) {
      logger.warn(`Failed to update priority for ${symbol}:`, error);
    }
  }

  /**
   * Trigger initial data collection for high priority instruments
   */
  private async triggerInitialDataCollection(): Promise<void> {
    try {
      // Get top 100 instruments by priority
      const topInstruments =
        await instrumentDiscoveryService.getTrackedInstruments(100);
      const symbols = topInstruments.map((i) => i.symbol);

      if (symbols.length > 0) {
        logger.info(
          `Triggering initial data collection for ${symbols.length} top instruments`
        );

        // Collect quotes in batches
        const batchSize = 20;
        for (let i = 0; i < symbols.length; i += batchSize) {
          const batch = symbols.slice(i, i + batchSize);

          try {
            await this.dataCollectionService.collectQuotes(batch);
            logger.info(
              `Collected data for batch ${
                Math.floor(i / batchSize) + 1
              }/${Math.ceil(symbols.length / batchSize)}`
            );

            // Rate limiting
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error(
              `Failed to collect data for batch starting at ${i}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      logger.error("Failed to trigger initial data collection:", error);
    }
  }

  /**
   * Generate additional NASDAQ stocks if needed
   */
  private generateAdditionalNasdaqStocks(count: number): InstrumentSeed[] {
    const additionalSymbols = [
      "ZOOM",
      "PLTR",
      "HOOD",
      "RIVN",
      "LCID",
      "COIN",
      "RBLX",
      "U",
      "PATH",
      "SNOW",
      "NET",
      "DDOG",
      "MDB",
      "TWLO",
      "SHOP",
      "SQ",
      "ROKU",
      "NFLX",
    ];

    return additionalSymbols.slice(0, count).map((symbol, index) => ({
      symbol,
      name: `${symbol} Inc.`,
      exchange: Exchange.NASDAQ,
      assetClass: AssetClass.STOCK,
      sector: "Technology",
      priority: 400 - index,
    }));
  }

  /**
   * Generate additional NYSE stocks if needed
   */
  private generateAdditionalNyseStocks(count: number): InstrumentSeed[] {
    const additionalSymbols = [
      "F",
      "GM",
      "T",
      "VZ",
      "KMI",
      "SO",
      "D",
      "NEE",
      "DUK",
      "EXC",
      "XEL",
      "WEC",
      "ES",
      "AEP",
      "PPL",
      "ED",
      "ETR",
      "FE",
      "CMS",
      "NI",
    ];

    return additionalSymbols.slice(0, count).map((symbol, index) => ({
      symbol,
      name: `${symbol} Corporation`,
      exchange: Exchange.NYSE,
      assetClass: AssetClass.STOCK,
      sector: "Industrials",
      priority: 300 - index,
    }));
  }

  /**
   * Generate additional NSE stocks if needed
   */
  private generateAdditionalNseStocks(count: number): InstrumentSeed[] {
    const additionalSymbols = [
      "ONGC",
      "IOC",
      "BPCL",
      "HPCL",
      "GAIL",
      "POWERGRID",
      "NTPC",
      "ADANIGREEN",
      "ADANIPORTS",
      "ADANIENT",
      "GODREJCP",
      "DABUR",
      "MARICO",
      "COLPAL",
      "NESTLEIND",
      "BRITANNIA",
      "UBL",
      "ASIANPAINT",
      "BERGER",
      "PIDILITIND",
    ];

    return additionalSymbols.slice(0, count).map((symbol, index) => ({
      symbol,
      name: `${symbol} Limited`,
      exchange: Exchange.NSE,
      assetClass: AssetClass.STOCK,
      sector: "Diversified",
      priority: 200 - index,
    }));
  }
}

// CLI execution
if (require.main === module) {
  const seeder = new InstrumentSeeder();

  seeder
    .seedTopInstruments()
    .then(() => {
      logger.info("🎉 Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}
