import * as cron from "node-cron";
import { createLogger } from "../utils/logger";
import { BackgroundAgent } from "./BackgroundAgent";
import { DatabaseService } from "./DatabaseService";

const logger = createLogger("dynamic-scheduler");

export interface InstrumentScheduleConfig {
  symbol: string;
  assetClass: string;
  exchange: string;
  volume24h?: number;
  marketCap?: number;
  volatility?: number;
  refreshFrequency: number; // minutes
  priority: "HIGH" | "MEDIUM" | "LOW";
  lastUpdated?: Date;
}

export interface DynamicScheduleConfig {
  // Base frequencies by asset class (in minutes)
  assetClassFrequencies: {
    STOCK: number;
    ETF: number;
    MUTUAL_FUND: number;
    CRYPTO: number;
    COMMODITY: number;
    FOREX: number;
    BOND: number;
  };

  // Volume-based multipliers
  volumeMultipliers: {
    veryHigh: number; // >10M volume
    high: number; // 1M-10M volume
    medium: number; // 100K-1M volume
    low: number; // <100K volume
  };

  // Market cap adjustments
  marketCapMultipliers: {
    largeCap: number; // >10B
    midCap: number; // 2B-10B
    smallCap: number; // 300M-2B
    microCap: number; // <300M
  };

  // Exchange-specific adjustments
  exchangeMultipliers: {
    [key: string]: number;
  };

  // Market hours consideration
  marketHours: {
    preMarket: { start: string; end: string; multiplier: number };
    regular: { start: string; end: string; multiplier: number };
    afterHours: { start: string; end: string; multiplier: number };
    closed: { multiplier: number };
  };
}

export class DynamicScheduler {
  private backgroundAgent: BackgroundAgent;
  private databaseService: DatabaseService;
  private config: DynamicScheduleConfig;
  private instrumentSchedules: Map<string, cron.ScheduledTask> = new Map();
  private instrumentConfigs: Map<string, InstrumentScheduleConfig> = new Map();
  private isRunning = false;
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    backgroundAgent: BackgroundAgent,
    config?: Partial<DynamicScheduleConfig>
  ) {
    this.backgroundAgent = backgroundAgent;
    this.databaseService = new DatabaseService();
    this.config = {
      // Base frequencies by asset class (in minutes)
      assetClassFrequencies: {
        STOCK: 5, // Equities: every 5 minutes
        ETF: 1440, // ETFs: daily (1440 minutes)
        MUTUAL_FUND: 1440, // Mutual funds: daily
        CRYPTO: 1, // Crypto: every minute
        COMMODITY: 15, // Commodities: every 15 minutes
        FOREX: 5, // Forex: every 5 minutes
        BOND: 60, // Bonds: every hour
      },

      // Volume-based frequency multipliers (lower = more frequent)
      volumeMultipliers: {
        veryHigh: 0.5, // 2x more frequent for high volume
        high: 0.75, // 1.33x more frequent
        medium: 1.0, // Base frequency
        low: 2.0, // 2x less frequent for low volume
      },

      // Market cap adjustments
      marketCapMultipliers: {
        largeCap: 0.8, // Large caps slightly more frequent
        midCap: 1.0, // Base frequency
        smallCap: 1.2, // Small caps slightly less frequent
        microCap: 1.5, // Micro caps less frequent
      },

      // Exchange-specific multipliers
      exchangeMultipliers: {
        NASDAQ: 1.0,
        NYSE: 1.0,
        NSE: 1.2, // Indian market slightly less frequent
        BSE: 1.3,
        LSE: 1.1,
        TSE: 1.1,
      },

      // Market hours consideration
      marketHours: {
        preMarket: { start: "04:00", end: "09:30", multiplier: 1.5 }, // Less frequent in pre-market
        regular: { start: "09:30", end: "16:00", multiplier: 1.0 }, // Normal frequency
        afterHours: { start: "16:00", end: "20:00", multiplier: 1.3 }, // Slightly less frequent
        closed: { multiplier: 3.0 }, // Much less frequent when market closed
      },

      ...config,
    };
  }

  /**
   * Start dynamic scheduling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info("Dynamic scheduler is already running");
      return;
    }

    logger.info("Starting dynamic scheduler...");

    try {
      // Load all instruments and calculate their schedules
      await this.refreshInstrumentSchedules();

      // Start periodic refresh of schedules (every 30 minutes)
      this.refreshTimer = setInterval(async () => {
        await this.refreshInstrumentSchedules();
      }, 30 * 60 * 1000);

      this.isRunning = true;
      logger.info(
        `Dynamic scheduler started with ${this.instrumentSchedules.size} instruments`
      );
    } catch (error) {
      logger.error("Failed to start dynamic scheduler:", error);
      throw error;
    }
  }

  /**
   * Stop dynamic scheduling
   */
  stop(): void {
    if (!this.isRunning) {
      logger.info("Dynamic scheduler is not running");
      return;
    }

    logger.info("Stopping dynamic scheduler...");

    // Stop all instrument schedules
    this.instrumentSchedules.forEach((task, symbol) => {
      task.stop();
    });
    this.instrumentSchedules.clear();
    this.instrumentConfigs.clear();

    // Clear refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.isRunning = false;
    logger.info("Dynamic scheduler stopped");
  }

  /**
   * Refresh instrument schedules from database
   */
  private async refreshInstrumentSchedules(): Promise<void> {
    try {
      logger.info("Refreshing instrument schedules...");

      // Get all active instruments with their characteristics
      const instruments =
        await this.databaseService.getInstrumentsWithCharacteristics();

      const newConfigs = new Map<string, InstrumentScheduleConfig>();

      for (const instrument of instruments) {
        const config = this.calculateInstrumentSchedule(instrument);
        newConfigs.set(instrument.symbol, config);

        // Update schedule if frequency changed or new instrument
        const existingConfig = this.instrumentConfigs.get(instrument.symbol);
        if (
          !existingConfig ||
          existingConfig.refreshFrequency !== config.refreshFrequency
        ) {
          this.updateInstrumentSchedule(config);
        }
      }

      // Remove schedules for instruments no longer active
      for (const [symbol] of this.instrumentConfigs) {
        if (!newConfigs.has(symbol)) {
          this.removeInstrumentSchedule(symbol);
        }
      }

      this.instrumentConfigs = newConfigs;

      logger.info(`Refreshed schedules for ${instruments.length} instruments`);
    } catch (error) {
      logger.error("Failed to refresh instrument schedules:", error);
    }
  }

  /**
   * Calculate optimal refresh frequency for an instrument
   */
  private calculateInstrumentSchedule(
    instrument: any
  ): InstrumentScheduleConfig {
    // Base frequency from asset class
    const baseFrequency =
      this.config.assetClassFrequencies[
        instrument.assetClass as keyof typeof this.config.assetClassFrequencies
      ] || this.config.assetClassFrequencies.STOCK;

    // Volume-based adjustment
    const volumeMultiplier = this.getVolumeMultiplier(
      instrument.volume24h || 0
    );

    // Market cap adjustment
    const marketCapMultiplier = this.getMarketCapMultiplier(
      instrument.marketCap || 0
    );

    // Exchange adjustment
    const exchangeMultiplier =
      this.config.exchangeMultipliers[instrument.exchange] || 1.0;

    // Market hours adjustment
    const marketHoursMultiplier = this.getMarketHoursMultiplier(
      instrument.exchange
    );

    // Calculate final frequency
    const finalFrequency = Math.max(
      1, // Minimum 1 minute
      Math.round(
        baseFrequency *
          volumeMultiplier *
          marketCapMultiplier *
          exchangeMultiplier *
          marketHoursMultiplier
      )
    );

    // Determine priority based on frequency
    let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    if (finalFrequency <= 2) priority = "HIGH";
    else if (finalFrequency >= 60) priority = "LOW";

    return {
      symbol: instrument.symbol,
      assetClass: instrument.assetClass,
      exchange: instrument.exchange,
      volume24h: instrument.volume24h,
      marketCap: instrument.marketCap,
      volatility: instrument.volatility,
      refreshFrequency: finalFrequency,
      priority,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get volume-based frequency multiplier
   */
  private getVolumeMultiplier(volume: number): number {
    if (volume > 10_000_000) return this.config.volumeMultipliers.veryHigh;
    if (volume > 1_000_000) return this.config.volumeMultipliers.high;
    if (volume > 100_000) return this.config.volumeMultipliers.medium;
    return this.config.volumeMultipliers.low;
  }

  /**
   * Get market cap-based frequency multiplier
   */
  private getMarketCapMultiplier(marketCap: number): number {
    if (marketCap > 10_000_000_000)
      return this.config.marketCapMultipliers.largeCap;
    if (marketCap > 2_000_000_000)
      return this.config.marketCapMultipliers.midCap;
    if (marketCap > 300_000_000)
      return this.config.marketCapMultipliers.smallCap;
    return this.config.marketCapMultipliers.microCap;
  }

  /**
   * Get market hours-based frequency multiplier
   */
  private getMarketHoursMultiplier(exchange: string): number {
    // This is a simplified implementation - in production you'd check actual market hours by exchange
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Convert market hours to minutes from midnight
    const preMarketStart = this.timeToMinutes(
      this.config.marketHours.preMarket.start
    );
    const preMarketEnd = this.timeToMinutes(
      this.config.marketHours.preMarket.end
    );
    const regularStart = this.timeToMinutes(
      this.config.marketHours.regular.start
    );
    const regularEnd = this.timeToMinutes(this.config.marketHours.regular.end);
    const afterHoursStart = this.timeToMinutes(
      this.config.marketHours.afterHours.start
    );
    const afterHoursEnd = this.timeToMinutes(
      this.config.marketHours.afterHours.end
    );

    // Check which market session we're in
    if (currentTime >= preMarketStart && currentTime < preMarketEnd) {
      return this.config.marketHours.preMarket.multiplier;
    } else if (currentTime >= regularStart && currentTime < regularEnd) {
      return this.config.marketHours.regular.multiplier;
    } else if (currentTime >= afterHoursStart && currentTime < afterHoursEnd) {
      return this.config.marketHours.afterHours.multiplier;
    } else {
      return this.config.marketHours.closed.multiplier;
    }
  }

  /**
   * Convert time string (HH:MM) to minutes from midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Update or create schedule for a specific instrument
   */
  private updateInstrumentSchedule(config: InstrumentScheduleConfig): void {
    // Stop existing schedule if it exists
    const existingTask = this.instrumentSchedules.get(config.symbol);
    if (existingTask) {
      existingTask.stop();
    }

    // Create cron expression for the frequency
    const cronExpression = this.createCronExpression(config.refreshFrequency);

    // Create new scheduled task
    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeInstrumentTask(config);
      },
      {
        scheduled: this.isRunning,
        timezone: this.getTimezoneForExchange(config.exchange),
      }
    );

    this.instrumentSchedules.set(config.symbol, task);

    logger.debug(
      `Updated schedule for ${config.symbol}: every ${config.refreshFrequency} minutes (${config.assetClass})`
    );
  }

  /**
   * Remove schedule for an instrument
   */
  private removeInstrumentSchedule(symbol: string): void {
    const task = this.instrumentSchedules.get(symbol);
    if (task) {
      task.stop();
      this.instrumentSchedules.delete(symbol);
      logger.debug(`Removed schedule for ${symbol}`);
    }
  }

  /**
   * Execute task for a specific instrument
   */
  private async executeInstrumentTask(
    config: InstrumentScheduleConfig
  ): Promise<void> {
    try {
      // Choose task type based on asset class and frequency
      let taskType:
        | "COMPANY_ANALYSIS"
        | "INSIGHT_GENERATION"
        | "DOCUMENT_DISCOVERY";

      if (config.refreshFrequency <= 5) {
        // High frequency instruments get live analysis
        taskType = "COMPANY_ANALYSIS";
      } else if (config.refreshFrequency <= 60) {
        // Medium frequency instruments get insight generation
        taskType = "INSIGHT_GENERATION";
      } else {
        // Low frequency instruments get document discovery
        taskType = "DOCUMENT_DISCOVERY";
      }

      await this.backgroundAgent.addTask({
        type: taskType,
        symbol: config.symbol,
        priority: config.priority,
        options: {
          assetClass: config.assetClass,
          exchange: config.exchange,
          dynamicScheduling: true,
          refreshFrequency: config.refreshFrequency,
        },
      });

      logger.debug(
        `Executed ${taskType} for ${config.symbol} (${config.assetClass})`
      );
    } catch (error) {
      logger.error(`Failed to execute task for ${config.symbol}:`, error);
    }
  }

  /**
   * Create cron expression for given frequency in minutes
   */
  private createCronExpression(frequencyMinutes: number): string {
    if (frequencyMinutes === 1) {
      return "* * * * *"; // Every minute
    } else if (frequencyMinutes < 60) {
      return `*/${frequencyMinutes} * * * *`; // Every N minutes
    } else if (frequencyMinutes === 60) {
      return "0 * * * *"; // Every hour
    } else if (frequencyMinutes < 1440) {
      const hours = Math.floor(frequencyMinutes / 60);
      return `0 */${hours} * * *`; // Every N hours
    } else {
      const days = Math.floor(frequencyMinutes / 1440);
      return `0 0 */${days} * *`; // Every N days
    }
  }

  /**
   * Get timezone for exchange
   */
  private getTimezoneForExchange(exchange: string): string {
    const timezones: Record<string, string> = {
      NASDAQ: "America/New_York",
      NYSE: "America/New_York",
      NSE: "Asia/Kolkata",
      BSE: "Asia/Kolkata",
      LSE: "Europe/London",
      TSE: "Asia/Tokyo",
    };
    return timezones[exchange] || "America/New_York";
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    totalInstruments: number;
    scheduleBreakdown: Record<string, number>;
    avgFrequency: number;
  } {
    const scheduleBreakdown: Record<string, number> = {};
    let totalFrequency = 0;

    this.instrumentConfigs.forEach((config) => {
      const key = `${config.assetClass}_${config.refreshFrequency}min`;
      scheduleBreakdown[key] = (scheduleBreakdown[key] || 0) + 1;
      totalFrequency += config.refreshFrequency;
    });

    return {
      isRunning: this.isRunning,
      totalInstruments: this.instrumentConfigs.size,
      scheduleBreakdown,
      avgFrequency:
        this.instrumentConfigs.size > 0
          ? totalFrequency / this.instrumentConfigs.size
          : 0,
    };
  }

  /**
   * Force refresh schedule for specific instrument
   */
  async refreshInstrument(symbol: string): Promise<void> {
    try {
      const instrument =
        await this.databaseService.getInstrumentWithCharacteristics(symbol);
      if (instrument) {
        const config = this.calculateInstrumentSchedule(instrument);
        this.instrumentConfigs.set(symbol, config);
        this.updateInstrumentSchedule(config);
        logger.info(
          `Refreshed schedule for ${symbol}: ${config.refreshFrequency} minutes`
        );
      }
    } catch (error) {
      logger.error(`Failed to refresh schedule for ${symbol}:`, error);
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.stop();
    await this.databaseService.disconnect();
  }
}
