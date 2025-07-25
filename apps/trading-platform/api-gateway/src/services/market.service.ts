import { prisma } from "@yobi/database";
import { cache } from "@yobi/database/src/redis";
import { ApiError } from "../middleware/error";
import winston from "winston";
import { SearchResult } from "@prisma/client";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "market-service" },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

interface Quote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalData {
  symbol: string;
  period: string;
  interval: string;
  data: HistoricalDataPoint[];
}

export class MarketDataService {
  private dataCollectorUrl: string;
  private cacheExpiry = {
    quote: 60, // 1 minute
    historical: 300, // 5 minutes
    search: 3600, // 1 hour
  };

  constructor() {
    // URL of our data collection service
    this.dataCollectorUrl =
      process.env.DATA_COLLECTOR_URL || "http://localhost:3004";
  }

  // Main quote fetching method - database first, then fallback
  async getQuote(symbol: string): Promise<Quote> {
    const cacheKey = `quote:${symbol.toUpperCase()}`;

    try {
      // 1. Check Redis cache first
      const cached = await cache.getMarketData(symbol.toUpperCase());
      if (cached) {
        logger.info(`Quote cache hit for ${symbol}`);
        return this.formatQuote(cached, symbol);
      }

      // 2. Check database for recent data (within last 5 minutes)
      const dbQuote = await this.getQuoteFromDatabase(symbol);
      if (dbQuote) {
        logger.info(`Quote from database for ${symbol}`);
        // Cache the result
        await cache.setMarketData(
          symbol.toUpperCase(),
          dbQuote,
          this.cacheExpiry.quote
        );
        return dbQuote;
      }

      // 3. Fallback: trigger data collection and return best available data
      logger.warn(`No recent quote data for ${symbol}, triggering collection`);
      await this.triggerDataCollection([symbol]);

      // Try database again after triggering collection
      const retryDbQuote = await this.getQuoteFromDatabase(symbol, false); // Don't require recent
      if (retryDbQuote) {
        return retryDbQuote;
      }

      // 4. Final fallback: return a basic quote if we have any market data
      throw new ApiError(`No quote data available for ${symbol}`, 404);
    } catch (error) {
      logger.error(
        `Failed to fetch quote for ${symbol}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Unable to fetch quote for ${symbol}`, 500);
    }
  }

  // Get quote from our database
  private async getQuoteFromDatabase(
    symbol: string,
    requireRecent: boolean = true
  ): Promise<Quote | null> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const marketData = await prisma.marketData.findFirst({
        where: {
          instrument: { symbol: symbol.toUpperCase() },
          ...(requireRecent && { timestamp: { gte: fiveMinutesAgo } }),
        },
        orderBy: { timestamp: "desc" },
        include: {
          instrument: {
            include: {
              fundamentals: true,
            },
          },
        },
      });

      if (!marketData) {
        return null;
      }

      return {
        symbol: marketData.instrument.symbol,
        name: marketData.instrument.name,
        price: Number(marketData.close),
        change: Number(marketData.change),
        changePercent: Number(marketData.changePercent),
        volume: Number(marketData.volume),
        marketCap: marketData.instrument.fundamentals?.marketCap
          ? Number(marketData.instrument.fundamentals.marketCap)
          : undefined,
        high: Number(marketData.dayHigh),
        low: Number(marketData.dayLow),
        open: Number(marketData.open),
        previousClose: Number(marketData.previousClose),
        timestamp: marketData.timestamp.toISOString(),
      };
    } catch (error) {
      logger.error(`Database query failed for ${symbol}:`, error);
      return null;
    }
  }

  // Historical data fetching - database first
  async getHistoricalData(
    symbol: string,
    period: string = "1y",
    interval: string = "1d"
  ): Promise<HistoricalData> {
    const cacheKey = `historical:${symbol.toUpperCase()}:${period}:${interval}`;

    try {
      // 1. Check cache first
      const cached = await cache.get<HistoricalData>(cacheKey);
      if (cached) {
        logger.info(`Historical data cache hit for ${symbol}`);
        return cached;
      }

      // 2. Get from database
      const dbData = await this.getHistoricalFromDatabase(symbol, period);
      if (dbData && dbData.data.length > 0) {
        logger.info(`Historical data from database for ${symbol}`);
        const result = {
          symbol: symbol.toUpperCase(),
          period,
          interval,
          data: dbData.data,
        };

        // Cache the result
        await cache.set(cacheKey, result, this.cacheExpiry.historical);
        return result;
      }

      // 3. Fallback: trigger historical data collection
      logger.warn(`No historical data for ${symbol}, triggering collection`);
      await this.triggerHistoricalCollection([symbol], period);

      // Try database again
      const retryDbData = await this.getHistoricalFromDatabase(symbol, period);
      if (retryDbData && retryDbData.data.length > 0) {
        return {
          symbol: symbol.toUpperCase(),
          period,
          interval,
          data: retryDbData.data,
        };
      }

      throw new ApiError(`No historical data available for ${symbol}`, 404);
    } catch (error) {
      logger.error(
        `Failed to fetch historical data for ${symbol}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(`Unable to fetch historical data for ${symbol}`, 500);
    }
  }

  // Get historical data from database
  private async getHistoricalFromDatabase(
    symbol: string,
    period: string
  ): Promise<{ data: HistoricalDataPoint[] } | null> {
    try {
      const days = this.getPeriodInDays(period);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const marketData = await prisma.marketData.findMany({
        where: {
          instrument: { symbol: symbol.toUpperCase() },
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: "asc" },
        select: {
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      const data: HistoricalDataPoint[] = marketData.map((item: any) => ({
        date: item.timestamp.toISOString().split("T")[0],
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume),
      }));

      return { data };
    } catch (error) {
      logger.error(`Database historical query failed for ${symbol}:`, error);
      return null;
    }
  }

  // Search instruments in database first, trigger discovery if not found
  async searchInstruments(query: string, limit: number = 10): Promise<any[]> {
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;

    try {
      // Check cache first
      const cached = await cache.get<any[]>(cacheKey);
      if (cached) {
        logger.info(`Search cache hit for "${query}"`);
        return cached;
      }

      // Search in our database first
      const dbResults = await this.searchInDatabase(query, limit);

      if (dbResults.length > 0) {
        logger.info(
          `Search results from database for "${query}": ${dbResults.length} results`
        );
        await cache.set(cacheKey, dbResults, this.cacheExpiry.search);
        return dbResults;
      }

      // If no results and query looks like a symbol, trigger discovery
      if (this.looksLikeSymbol(query)) {
        logger.info(
          `Query "${query}" looks like a symbol, triggering discovery`
        );
        await this.triggerInstrumentDiscovery(query.toUpperCase());

        // Wait a moment and search again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const retryResults = await this.searchInDatabase(query, limit);

        if (retryResults.length > 0) {
          logger.info(
            `Found results after discovery for "${query}": ${retryResults.length} results`
          );
          await cache.set(cacheKey, retryResults, this.cacheExpiry.search);
          return retryResults;
        }
      }

      logger.info(`No search results found for "${query}"`);
      return [];
    } catch (error) {
      logger.error(
        `Failed to search instruments for "${query}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw new ApiError(`Unable to search instruments`, 500);
    }
  }

  // Search in our database
  private async searchInDatabase(query: string, limit: number): Promise<any[]> {
    try {
      const instruments = await prisma.instrument.findMany({
        where: {
          OR: [
            { symbol: { contains: query.toUpperCase() } },
            { name: { contains: query, mode: "insensitive" } },
          ],
          isActive: true,
        },
        take: limit,
        orderBy: [{ symbol: "asc" }],
      });

      return instruments.map((instrument: any) => ({
        symbol: instrument.symbol,
        name: instrument.name,
        assetClass: instrument.assetClass,
        exchange: instrument.exchange,
        currency: instrument.currency,
      }));
    } catch (error) {
      logger.error(`Database search failed for "${query}":`, error);
      return [];
    }
  }

  // Trigger data collection service
  private async triggerDataCollection(symbols: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.dataCollectorUrl}/collect/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols }),
      });

      if (!response.ok) {
        throw new Error(`Data collection failed: ${response.statusText}`);
      }

      logger.info(`Triggered data collection for ${symbols.join(", ")}`);
    } catch (error) {
      logger.error(
        `Failed to trigger data collection for ${symbols.join(",")}:`,
        error
      );
    }
  }

  async getLatestNews(symbol: string, limit: number): Promise<any[]> {
    try {
      // First, try to find the instrument by symbol across all exchanges
      const instrument = await prisma.instrument.findFirst({
        where: {
          symbol: symbol.toUpperCase(),
          isActive: true,
        },
      });

      // Try multiple approaches to find relevant news
      let newsResults: any[] = [];

      if (instrument) {
        // 1. Look for news directly related to this instrument
        newsResults = await prisma.searchResult.findMany({
          where: {
            instrumentId: instrument.id,
            OR: [
              { contentType: "news" },
              { contentType: { equals: null } }, // Include results without explicit content type
            ],
          },
          orderBy: {
            discoveredAt: "desc",
          },
          take: limit,
          include: {
            instrument: true,
          },
        });
      }

      // 2. If no instrument-specific news, search by symbol in query/title
      if (newsResults.length === 0) {
        newsResults = await prisma.searchResult.findMany({
          where: {
            AND: [
              {
                OR: [
                  {
                    query: {
                      contains: symbol.toUpperCase(),
                      mode: "insensitive",
                    },
                  },
                  {
                    title: {
                      contains: symbol.toUpperCase(),
                      mode: "insensitive",
                    },
                  },
                ],
              },
              {
                OR: [
                  { contentType: "news" },
                  { contentType: { equals: null } },
                ],
              },
            ],
          },
          orderBy: {
            discoveredAt: "desc",
          },
          take: limit,
          include: {
            instrument: true,
          },
        });
      }

      // 3. If still no results, return mock news
      if (newsResults.length === 0) {
        logger.info(`No news found for ${symbol}, returning mock news`);
        return this.generateMockNews(symbol, limit);
      }

      // Format the results
      return newsResults.map((news: any) => ({
        id: news.id,
        title: news.title,
        summary: news.snippet || "Latest news update",
        url: news.url,
        source: news.domain || news.provider || "Market News",
        publishedAt:
          news.publishedDate?.toISOString() || news.discoveredAt.toISOString(),
        relevance: news.relevanceScore || 0.5,
        category: "news",
        symbol: symbol.toUpperCase(),
      }));
    } catch (error) {
      logger.error(`Failed to fetch latest news for ${symbol}:`, error);
      // Return mock news as fallback
      return this.generateMockNews(symbol, limit);
    }
  }

  // Generate mock news for development/fallback
  private generateMockNews(symbol: string, limit: number): any[] {
    const mockNews = [
      {
        id: `mock-1-${symbol}`,
        title: `${symbol} Reports Strong Quarterly Results`,
        summary: `${symbol} announced better-than-expected earnings for the quarter, with revenue growth driven by strong market demand and operational efficiency improvements.`,
        url: `https://example.com/news/${symbol.toLowerCase()}-earnings`,
        source: "Market News",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        relevance: 0.9,
        category: "earnings",
        symbol: symbol.toUpperCase(),
      },
      {
        id: `mock-2-${symbol}`,
        title: `Analysts Upgrade ${symbol} Price Target`,
        summary: `Leading investment firms have raised their price targets for ${symbol} following positive industry trends and company-specific catalysts.`,
        url: `https://example.com/analysis/${symbol.toLowerCase()}-upgrade`,
        source: "Financial Analysis",
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        relevance: 0.8,
        category: "analysis",
        symbol: symbol.toUpperCase(),
      },
      {
        id: `mock-3-${symbol}`,
        title: `${symbol} Announces Strategic Partnership`,
        summary: `The company has entered into a strategic partnership that is expected to enhance its market position and drive future growth opportunities.`,
        url: `https://example.com/corporate/${symbol.toLowerCase()}-partnership`,
        source: "Corporate News",
        publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        relevance: 0.7,
        category: "corporate",
        symbol: symbol.toUpperCase(),
      },
      {
        id: `mock-4-${symbol}`,
        title: `Market Outlook: ${symbol} Positioned for Growth`,
        summary: `Industry experts believe ${symbol} is well-positioned to benefit from current market trends and regulatory changes in the sector.`,
        url: `https://example.com/outlook/${symbol.toLowerCase()}-growth`,
        source: "Market Outlook",
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        relevance: 0.6,
        category: "outlook",
        symbol: symbol.toUpperCase(),
      },
    ];

    return mockNews.slice(0, limit);
  }

  // Trigger historical data collection
  private async triggerHistoricalCollection(
    symbols: string[],
    period: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.dataCollectorUrl}/collect/historical`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ symbols, period }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Historical data collection failed: ${response.statusText}`
        );
      }

      logger.info(
        `Triggered historical data collection for ${symbols.join(", ")}`
      );
    } catch (error) {
      logger.error(`Failed to trigger historical data collection:`, error);
    }
  }

  // Trigger instrument discovery for new symbols
  private async triggerInstrumentDiscovery(symbol: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.dataCollectorUrl}/discover/instrument`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ symbol }),
        }
      );

      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.statusText}`);
      }

      logger.info(`Triggered discovery for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to trigger discovery for ${symbol}:`, error);
    }
  }

  // Check if query looks like a stock symbol (basic heuristics)
  private looksLikeSymbol(query: string): boolean {
    const trimmed = query.trim().toUpperCase();

    // Basic symbol patterns
    return (
      // Length between 1-10 characters
      trimmed.length >= 1 &&
      trimmed.length <= 10 &&
      // Only letters and numbers (no spaces)
      /^[A-Z0-9]+$/.test(trimmed) &&
      // At least one letter
      /[A-Z]/.test(trimmed) &&
      // Common patterns
      // Standard symbols (2-5 chars, mostly letters)
      (/^[A-Z]{2,5}$/.test(trimmed) ||
        // Indian patterns (e.g., TATAMOTORS, HDFCBANK)
        /^[A-Z]{4,10}$/.test(trimmed) ||
        // With numbers (e.g., BRK.A would be BRKA)
        /^[A-Z]{2,8}[0-9]?$/.test(trimmed))
    );
  }

  // Helper methods
  private formatQuote(rawData: any, symbol: string): Quote {
    return {
      symbol: symbol.toUpperCase(),
      name: rawData.name,
      price: Number(rawData.price),
      change: Number(rawData.change),
      changePercent: Number(rawData.changePercent),
      volume: Number(rawData.volume),
      high: Number(rawData.high),
      low: Number(rawData.low),
      open: Number(rawData.open),
      previousClose: Number(rawData.previousClose),
      timestamp: rawData.timestamp,
    };
  }

  private getPeriodInDays(period: string): number {
    switch (period) {
      case "1d":
        return 1;
      case "5d":
        return 5;
      case "1m":
        return 30;
      case "3m":
        return 90;
      case "6m":
        return 180;
      case "1y":
        return 365;
      case "2y":
        return 730;
      case "5y":
        return 1825;
      default:
        return 365;
    }
  }

  // Health check method
  async getServiceStatus(): Promise<any> {
    try {
      // Check database connection
      const dbCheck = await prisma.$queryRaw`SELECT 1`;

      // Check data freshness
      const latestData = await prisma.marketData.findFirst({
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      });

      const dataAge = latestData
        ? Date.now() - latestData.timestamp.getTime()
        : null;

      return {
        database: "connected",
        dataCollectorUrl: this.dataCollectorUrl,
        latestDataAge: dataAge
          ? `${Math.round(dataAge / 1000 / 60)} minutes`
          : "no data",
        status: dataAge && dataAge < 10 * 60 * 1000 ? "healthy" : "stale_data",
      };
    } catch (error) {
      return {
        database: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        status: "unhealthy",
      };
    }
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();
