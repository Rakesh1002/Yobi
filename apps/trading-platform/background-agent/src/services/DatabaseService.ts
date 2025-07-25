import { PrismaClient, Exchange } from "@prisma/client";
import { createLogger } from "../utils/logger";

const logger = createLogger("database-service");

export interface InstrumentInfo {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  assetClass: string;
  sector?: string;
  industry?: string;
}

// New interfaces for storage operations
export interface CreateSearchResultData {
  instrumentId: string;
  query: string;
  title: string;
  url: string;
  snippet?: string;
  provider: string;
  relevanceScore: number;
  publishedDate?: Date | null;
  contentType?: string;
  domain?: string;
  metadata: any;
}

export interface CreateDocumentData {
  instrumentId: string;
  title: string;
  url: string;
  documentType: string;
  filingType?: string;
  publishedDate?: Date | null;
  status: string;
  s3Key?: string;
  s3Bucket?: string;
  contentHash?: string;
  fileSize?: bigint | null;
  extractedText?: string;
  summary?: string | null;
  keyPoints: string[];
  sourceProvider: string;
  sourceUrl: string;
  metadata: any;
}

export interface CreateInsightData {
  instrumentId: string;
  analysisType: string;
  recommendation: string;
  confidence: number;
  targetPrice?: number;
  stopLoss?: number;
  timeHorizon: string;
  summary: string;
  keyInsights: string[];
  risks: string[];
  opportunities: string[];
  rationale: string;
  sourcesUsed: any;
  dataQuality: number;
  dataFreshness: Date;
  validUntil?: Date | null;
  modelVersion?: string;
  tokenCount?: number;
}

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    try {
      this.prisma = new PrismaClient();
      logger.info("Database service initialized");
    } catch (error) {
      logger.error("Failed to initialize database service:", error);
      throw error;
    }
  }

  /**
   * Get all active instruments
   */
  async getActiveInstruments(): Promise<InstrumentInfo[]> {
    try {
      const instruments = await this.prisma.instrument.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ exchange: "asc" }, { symbol: "asc" }],
      });

      return instruments.map((instrument) => ({
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        currency: instrument.currency,
        assetClass: instrument.assetClass,
        sector: instrument.sector || undefined,
        industry: instrument.industry || undefined,
      }));
    } catch (error) {
      logger.error("Failed to get active instruments:", error);

      // Return fallback instruments if database fails
      return this.getFallbackInstruments();
    }
  }

  /**
   * Get instruments by exchange
   */
  async getInstrumentsByExchange(exchange: string): Promise<InstrumentInfo[]> {
    try {
      const instruments = await this.prisma.instrument.findMany({
        where: {
          exchange: exchange as Exchange,
          isActive: true,
        },
        orderBy: { symbol: "asc" },
      });

      return instruments.map((instrument) => ({
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        currency: instrument.currency,
        assetClass: instrument.assetClass,
        sector: instrument.sector || undefined,
        industry: instrument.industry || undefined,
      }));
    } catch (error) {
      logger.error(
        `Failed to get instruments for exchange ${exchange}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get priority instruments for processing
   */
  async getPriorityInstruments(limit: number = 50): Promise<InstrumentInfo[]> {
    try {
      // For now, get recent instruments or those with high volume
      // This can be enhanced with actual priority logic
      const instruments = await this.prisma.instrument.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
      });

      return instruments.map((instrument) => ({
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        currency: instrument.currency,
        assetClass: instrument.assetClass,
        sector: instrument.sector || undefined,
        industry: instrument.industry || undefined,
      }));
    } catch (error) {
      logger.error("Failed to get priority instruments:", error);
      return this.getFallbackInstruments().slice(0, limit);
    }
  }

  /**
   * Get instruments that need document updates
   */
  async getInstrumentsNeedingDocumentUpdate(
    limit: number = 30
  ): Promise<InstrumentInfo[]> {
    try {
      // Get instruments with no recent document updates (last 24 hours)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const instruments = await this.prisma.instrument.findMany({
        where: {
          isActive: true,
          OR: [
            {
              documents: {
                none: {},
              },
            },
            {
              documents: {
                none: {
                  createdAt: {
                    gte: cutoffDate,
                  },
                },
              },
            },
          ],
        },
        take: limit,
        orderBy: { symbol: "asc" },
      });

      return instruments.map((instrument) => ({
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        currency: instrument.currency,
        assetClass: instrument.assetClass,
        sector: instrument.sector || undefined,
        industry: instrument.industry || undefined,
      }));
    } catch (error) {
      logger.error(
        "Failed to get instruments needing document updates:",
        error
      );
      return this.getFallbackInstruments().slice(0, limit);
    }
  }

  /**
   * Check if instrument exists
   */
  async instrumentExists(symbol: string, exchange?: string): Promise<boolean> {
    try {
      const whereClause: any = { symbol };
      if (exchange) {
        whereClause.exchange = exchange;
      }

      const count = await this.prisma.instrument.count({
        where: whereClause,
      });

      return count > 0;
    } catch (error) {
      logger.error(`Failed to check if instrument exists: ${symbol}`, error);
      return false;
    }
  }

  /**
   * Get last market data update for an instrument
   */
  async getLastMarketDataUpdate(symbol: string): Promise<Date | null> {
    try {
      const instrument = await this.prisma.instrument.findFirst({
        where: { symbol },
        include: {
          marketData: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      });

      return instrument?.marketData[0]?.timestamp || null;
    } catch (error) {
      logger.error(
        `Failed to get last market data update for ${symbol}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get earnings calendar symbols (mock implementation)
   */
  async getEarningsCalendarSymbols(date?: Date): Promise<string[]> {
    // Mock implementation - in real scenario, this would query earnings calendar
    const mockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
    return mockSymbols;
  }

  // === NEW STORAGE METHODS ===

  /**
   * Create search result
   */
  async createSearchResult(data: CreateSearchResultData) {
    try {
      const result = await this.prisma.searchResult.create({
        data: {
          instrumentId: data.instrumentId,
          query: data.query,
          title: data.title,
          url: data.url,
          snippet: data.snippet,
          provider: data.provider as any, // Prisma enum
          relevanceScore: data.relevanceScore,
          publishedDate: data.publishedDate,
          contentType: data.contentType,
          domain: data.domain,
          metadata: data.metadata,
          discoveredAt: new Date(),
        },
      });

      return {
        id: result.id,
        instrumentId: result.instrumentId,
        query: result.query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        provider: result.provider,
        relevanceScore: result.relevanceScore,
        publishedDate: result.publishedDate,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error("Failed to create search result:", error);
      throw error;
    }
  }

  /**
   * Find existing search result
   */
  async findSearchResult(instrumentId: string, url: string, provider: string) {
    try {
      const result = await this.prisma.searchResult.findUnique({
        where: {
          instrumentId_url_provider: {
            instrumentId,
            url,
            provider: provider as any,
          },
        },
      });

      if (!result) return null;

      return {
        id: result.id,
        instrumentId: result.instrumentId,
        query: result.query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        provider: result.provider,
        relevanceScore: result.relevanceScore,
        publishedDate: result.publishedDate,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error("Failed to find search result:", error);
      return null;
    }
  }

  /**
   * Create document
   */
  async createDocument(data: CreateDocumentData) {
    try {
      const document = await this.prisma.document.create({
        data: {
          instrumentId: data.instrumentId,
          title: data.title,
          url: data.url,
          documentType: data.documentType as any,
          filingType: data.filingType,
          publishedDate: data.publishedDate,
          status: data.status as any,
          s3Key: data.s3Key,
          s3Bucket: data.s3Bucket,
          contentHash: data.contentHash,
          fileSize: data.fileSize,
          extractedText: data.extractedText,
          summary: data.summary,
          keyPoints: data.keyPoints,
          sourceProvider: data.sourceProvider as any,
          sourceUrl: data.sourceUrl,
          metadata: data.metadata,
          discoveredAt: new Date(),
        },
      });

      return {
        id: document.id,
        instrumentId: document.instrumentId,
        title: document.title,
        url: document.url,
        documentType: document.documentType,
        s3Key: document.s3Key,
        s3Bucket: document.s3Bucket,
        contentHash: document.contentHash,
        extractedText: document.extractedText,
        summary: document.summary,
        metadata: document.metadata,
        status: document.status,
      };
    } catch (error) {
      logger.error("Failed to create document:", error);
      throw error;
    }
  }

  /**
   * Find document by content hash
   */
  async findDocumentByHash(instrumentId: string, contentHash: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: {
          instrumentId_contentHash: {
            instrumentId,
            contentHash,
          },
        },
      });

      if (!document) return null;

      return {
        id: document.id,
        instrumentId: document.instrumentId,
        title: document.title,
        url: document.url,
        documentType: document.documentType,
        s3Key: document.s3Key,
        s3Bucket: document.s3Bucket,
        contentHash: document.contentHash,
        extractedText: document.extractedText,
        summary: document.summary,
        metadata: document.metadata,
        status: document.status,
      };
    } catch (error) {
      logger.error("Failed to find document by hash:", error);
      return null;
    }
  }

  /**
   * Create AI insight
   */
  async createInsight(data: CreateInsightData) {
    try {
      const insight = await this.prisma.aiInsight.create({
        data: {
          instrumentId: data.instrumentId,
          analysisType: data.analysisType as any,
          recommendation: data.recommendation,
          confidence: data.confidence,
          targetPrice: data.targetPrice,
          stopLoss: data.stopLoss,
          timeHorizon: data.timeHorizon as any,
          summary: data.summary,
          keyInsights: data.keyInsights,
          risks: data.risks,
          opportunities: data.opportunities,
          rationale: data.rationale,
          sourcesUsed: data.sourcesUsed,
          dataQuality: data.dataQuality,
          dataFreshness: data.dataFreshness,
          validUntil: data.validUntil,
          modelVersion: data.modelVersion,
          tokenCount: data.tokenCount,
          generatedAt: new Date(),
        },
      });

      return {
        id: insight.id,
        instrumentId: insight.instrumentId,
        analysisType: insight.analysisType,
        recommendation: insight.recommendation,
        confidence: insight.confidence,
        summary: insight.summary,
        keyInsights: insight.keyInsights,
        risks: insight.risks,
        opportunities: insight.opportunities,
        rationale: insight.rationale,
        sourcesUsed: insight.sourcesUsed,
        dataQuality: insight.dataQuality,
        validUntil: insight.validUntil,
      };
    } catch (error) {
      logger.error("Failed to create insight:", error);
      throw error;
    }
  }

  /**
   * Deactivate previous insights
   */
  async deactivateInsights(instrumentId: string, analysisType: string) {
    try {
      await this.prisma.aiInsight.updateMany({
        where: {
          instrumentId,
          analysisType: analysisType as any,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      logger.error("Failed to deactivate insights:", error);
    }
  }

  /**
   * Get search results for instrument
   */
  async getSearchResults(instrumentId: string, limit: number = 100) {
    try {
      const results = await this.prisma.searchResult.findMany({
        where: { instrumentId },
        orderBy: { discoveredAt: "desc" },
        take: limit,
      });

      return results.map((result) => ({
        id: result.id,
        instrumentId: result.instrumentId,
        query: result.query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        provider: result.provider,
        relevanceScore: result.relevanceScore,
        publishedDate: result.publishedDate,
        metadata: result.metadata,
      }));
    } catch (error) {
      logger.error("Failed to get search results:", error);
      return [];
    }
  }

  /**
   * Get documents for instrument
   */
  async getDocuments(
    instrumentId: string,
    documentType?: string,
    limit: number = 50
  ) {
    try {
      const whereClause: any = { instrumentId };
      if (documentType) {
        whereClause.documentType = documentType;
      }

      const documents = await this.prisma.document.findMany({
        where: whereClause,
        orderBy: { discoveredAt: "desc" },
        take: limit,
      });

      return documents.map((doc) => ({
        id: doc.id,
        instrumentId: doc.instrumentId,
        title: doc.title,
        url: doc.url,
        documentType: doc.documentType,
        s3Key: doc.s3Key,
        s3Bucket: doc.s3Bucket,
        contentHash: doc.contentHash,
        extractedText: doc.extractedText,
        summary: doc.summary,
        metadata: doc.metadata,
        status: doc.status,
      }));
    } catch (error) {
      logger.error("Failed to get documents:", error);
      return [];
    }
  }

  /**
   * Get latest insights for instrument
   */
  async getLatestInsights(instrumentId: string) {
    try {
      const insight = await this.prisma.aiInsight.findFirst({
        where: {
          instrumentId,
          isActive: true,
        },
        orderBy: { generatedAt: "desc" },
      });

      if (!insight) return null;

      return {
        id: insight.id,
        instrumentId: insight.instrumentId,
        analysisType: insight.analysisType,
        recommendation: insight.recommendation,
        confidence: insight.confidence,
        summary: insight.summary,
        keyInsights: insight.keyInsights,
        risks: insight.risks,
        opportunities: insight.opportunities,
        rationale: insight.rationale,
        sourcesUsed: insight.sourcesUsed,
        dataQuality: insight.dataQuality,
        validUntil: insight.validUntil,
      };
    } catch (error) {
      logger.error("Failed to get latest insights:", error);
      return null;
    }
  }

  /**
   * Get instruments with characteristics for dynamic scheduling
   */
  async getInstrumentsWithCharacteristics(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          i.symbol,
          i.name,
          i.exchange,
          i."assetClass",
          i.sector,
          md.volume,
          md."changePercent",
          md.close as "currentPrice",
          md.timestamp as "lastMarketData"
        FROM "Instrument" i
        LEFT JOIN LATERAL (
          SELECT volume, "changePercent", close, timestamp
          FROM "MarketData" 
          WHERE "instrumentId" = i.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) md ON true
        WHERE i."isActive" = true
        ORDER BY 
          CASE 
            WHEN md.timestamp IS NOT NULL THEN md.timestamp 
            ELSE i."createdAt" 
          END DESC,
          CASE 
            WHEN md.volume IS NOT NULL THEN md.volume 
            ELSE 0 
          END DESC
      `;

      const result = await this.prisma.$queryRawUnsafe(query);

      // Calculate additional characteristics
      return (result as any[]).map((instrument) => ({
        ...instrument,
        volume24h: instrument.volume || 0,
        volatility: Math.abs(instrument.changePercent || 0), // Use absolute change as volatility proxy
        marketCap: this.estimateMarketCap(instrument),
        lastUpdated:
          instrument.lastMarketData ||
          new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to yesterday
      }));
    } catch (error) {
      logger.error("Failed to get instruments with characteristics:", error);

      // Fallback: get basic instrument data
      const instruments = await this.getActiveInstruments();
      return instruments.map((instrument) => ({
        ...instrument,
        volume24h: 0,
        volatility: 0,
        marketCap: this.estimateMarketCap(instrument),
        lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }));
    }
  }

  /**
   * Get single instrument with characteristics
   */
  async getInstrumentWithCharacteristics(symbol: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          i.symbol,
          i.name,
          i.exchange,
          i."assetClass",
          i.sector,
          md.volume,
          md."changePercent",
          md.close as "currentPrice",
          md.timestamp as "lastMarketData"
        FROM "Instrument" i
        LEFT JOIN LATERAL (
          SELECT volume, "changePercent", close, timestamp
          FROM "MarketData" 
          WHERE "instrumentId" = i.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) md ON true
        WHERE i."isActive" = true AND i.symbol = $1
      `;

      const result = await this.prisma.$queryRawUnsafe(query, symbol);
      const instruments = result as any[];

      if (instruments.length === 0) return null;

      const instrument = instruments[0];
      return {
        ...instrument,
        volume24h: instrument.volume || 0,
        volatility: Math.abs(instrument.changePercent || 0),
        marketCap: this.estimateMarketCap(instrument),
        lastUpdated:
          instrument.lastMarketData ||
          new Date(Date.now() - 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      logger.error(`Failed to get characteristics for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Estimate market cap for instruments without explicit market cap data
   */
  private estimateMarketCap(instrument: any): number {
    // Rough estimates based on exchange and known patterns
    if (instrument.exchange === "NASDAQ" || instrument.exchange === "NYSE") {
      // US market - assume medium to large cap for most listed companies
      return 5_000_000_000; // $5B default
    } else if (instrument.exchange === "NSE" || instrument.exchange === "BSE") {
      // Indian market - smaller average market caps
      return 1_000_000_000; // $1B default (in USD equivalent)
    } else {
      // Other markets
      return 2_000_000_000; // $2B default
    }
  }

  /**
   * Get fallback instruments when database is unavailable
   */
  private getFallbackInstruments(): InstrumentInfo[] {
    return [
      {
        id: "fallback-1",
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        assetClass: "STOCK",
      },
      {
        id: "fallback-2",
        symbol: "MSFT",
        name: "Microsoft Corporation",
        exchange: "NASDAQ",
        currency: "USD",
        assetClass: "STOCK",
      },
      {
        id: "fallback-3",
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        assetClass: "STOCK",
      },
      {
        id: "fallback-4",
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        assetClass: "STOCK",
      },
      {
        id: "fallback-5",
        symbol: "TSLA",
        name: "Tesla Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        assetClass: "STOCK",
      },
    ];
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info("Database service disconnected");
    } catch (error) {
      logger.error("Error disconnecting from database:", error);
    }
  }
}
