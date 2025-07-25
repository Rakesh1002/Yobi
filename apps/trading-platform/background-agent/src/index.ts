import express from "express";
import cors from "cors";
import { createLogger } from "./utils/logger";
import { BackgroundAgent } from "./services/BackgroundAgent";
import { DynamicScheduler } from "./services/DynamicScheduler"; // Replace AgentScheduler with DynamicScheduler
import { WebSearchService } from "./services/WebSearchService";
import { DocumentFetcher } from "./services/DocumentFetcher";
import { InsightsEngine } from "./services/InsightsEngine";
import dotenv from "dotenv";

// Load environment variables from root and local .env files
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../../../.env") }); // Root .env
dotenv.config(); // Local .env (if exists)

const logger = createLogger("background-agent");

const app = express();
const PORT = process.env.BACKGROUND_AGENT_PORT || process.env.PORT || 3009;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const webSearchService = new WebSearchService();
const documentFetcher = new DocumentFetcher();
const insightsEngine = new InsightsEngine();

// Configure agent with auto-start settings
const agentConfig = {
  autoStart: true,
  autoProcessExistingInstruments:
    process.env.AUTO_PROCESS_INSTRUMENTS !== "false",
  concurrency: parseInt(process.env.AGENT_CONCURRENCY || "3"),
  batchSize: parseInt(process.env.AGENT_BATCH_SIZE || "10"),
  retryAttempts: parseInt(process.env.AGENT_RETRY_ATTEMPTS || "3"),
  processingDelay: parseInt(process.env.AGENT_PROCESSING_DELAY || "5000"),
};

const backgroundAgent = new BackgroundAgent(
  webSearchService,
  documentFetcher,
  insightsEngine,
  agentConfig
);

// Configure dynamic scheduler with instrument-based frequencies
const dynamicSchedulerConfig = {
  // Asset class frequencies (in minutes)
  assetClassFrequencies: {
    STOCK: parseInt(process.env.STOCK_FREQUENCY || "5"), // Equities: every 5 minutes
    ETF: parseInt(process.env.ETF_FREQUENCY || "1440"), // ETFs: daily
    MUTUAL_FUND: parseInt(process.env.MUTUAL_FUND_FREQUENCY || "1440"), // Mutual funds: daily
    CRYPTO: parseInt(process.env.CRYPTO_FREQUENCY || "1"), // Crypto: every minute
    COMMODITY: parseInt(process.env.COMMODITY_FREQUENCY || "15"), // Commodities: every 15 minutes
    FOREX: parseInt(process.env.FOREX_FREQUENCY || "5"), // Forex: every 5 minutes
    BOND: parseInt(process.env.BOND_FREQUENCY || "60"), // Bonds: every hour
  },

  // Volume-based multipliers
  volumeMultipliers: {
    veryHigh: parseFloat(process.env.VOLUME_VERY_HIGH_MULTIPLIER || "0.5"),
    high: parseFloat(process.env.VOLUME_HIGH_MULTIPLIER || "0.75"),
    medium: parseFloat(process.env.VOLUME_MEDIUM_MULTIPLIER || "1.0"),
    low: parseFloat(process.env.VOLUME_LOW_MULTIPLIER || "2.0"),
  },

  // Market cap multipliers
  marketCapMultipliers: {
    largeCap: parseFloat(process.env.LARGE_CAP_MULTIPLIER || "0.8"),
    midCap: parseFloat(process.env.MID_CAP_MULTIPLIER || "1.0"),
    smallCap: parseFloat(process.env.SMALL_CAP_MULTIPLIER || "1.2"),
    microCap: parseFloat(process.env.MICRO_CAP_MULTIPLIER || "1.5"),
  },
};

const dynamicScheduler = new DynamicScheduler(
  backgroundAgent,
  dynamicSchedulerConfig
);

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "background-agent",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    config: {
      autoStart: agentConfig.autoStart,
      autoProcessInstruments: agentConfig.autoProcessExistingInstruments,
      concurrency: agentConfig.concurrency,
      batchSize: agentConfig.batchSize,
      dynamicScheduling: true,
    },
  });
});

// Agent control endpoints
app.get("/agent/status", async (req, res) => {
  try {
    const agentStatus = backgroundAgent.getStatus();
    const schedulerStatus = dynamicScheduler.getStatus();

    res.json({
      success: true,
      data: {
        agent: agentStatus,
        scheduler: schedulerStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get agent status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get agent status",
    });
  }
});

app.post("/agent/start", async (req, res) => {
  try {
    await backgroundAgent.start();
    res.json({
      success: true,
      message: "Background agent started successfully",
    });
  } catch (error) {
    logger.error("Failed to start agent:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start agent",
    });
  }
});

app.post("/agent/stop", async (req, res) => {
  try {
    await backgroundAgent.stop();
    res.json({
      success: true,
      message: "Background agent stopped successfully",
    });
  } catch (error) {
    logger.error("Failed to stop agent:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to stop agent",
    });
  }
});

// Dynamic scheduler control endpoints
app.get("/scheduler/status", (req, res) => {
  try {
    const status = dynamicScheduler.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get scheduler status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get scheduler status",
    });
  }
});

app.post("/scheduler/start", async (req, res) => {
  try {
    await dynamicScheduler.start();
    res.json({
      success: true,
      message: "Dynamic scheduler started successfully",
    });
  } catch (error) {
    logger.error("Failed to start scheduler:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to start scheduler",
    });
  }
});

app.post("/scheduler/stop", (req, res) => {
  try {
    dynamicScheduler.stop();
    res.json({
      success: true,
      message: "Dynamic scheduler stopped successfully",
    });
  } catch (error) {
    logger.error("Failed to stop scheduler:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to stop scheduler",
    });
  }
});

// Refresh specific instrument schedule
app.post("/scheduler/refresh/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    await dynamicScheduler.refreshInstrument(symbol);
    res.json({
      success: true,
      message: `Schedule refreshed for ${symbol}`,
    });
  } catch (error) {
    logger.error(`Failed to refresh schedule for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to refresh schedule",
    });
  }
});

// Manual task triggers (unchanged)
app.post("/search/company/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { searchType = "company" } = req.body;

    const results = await backgroundAgent.searchCompanyInformation(
      symbol,
      searchType
    );

    res.json({
      success: true,
      data: {
        symbol,
        searchType,
        results,
        resultCount: results.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Search failed for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
});

app.post("/fetch/documents/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const {
      documentTypes = ["ANNUAL_REPORT", "QUARTERLY_REPORT", "SEC_FILING"],
    } = req.body;

    const documents = await backgroundAgent.fetchCompanyDocuments(
      symbol,
      documentTypes
    );

    res.json({
      success: true,
      data: {
        symbol,
        documents,
        documentCount: documents.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Document fetch failed for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Document fetch failed",
    });
  }
});

app.post("/insights/generate/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const insights = await backgroundAgent.generateInsights(symbol);

    res.json({
      success: true,
      data: {
        symbol,
        insights,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Insight generation failed for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Insight generation failed",
    });
  }
});

app.post("/task/add", async (req, res) => {
  try {
    const { type, symbol, priority = "MEDIUM", options = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: "Task type is required",
      });
    }

    const taskId = await backgroundAgent.addTask({
      type,
      symbol,
      priority,
      options,
    });

    res.json({
      success: true,
      data: { taskId },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to add task:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to add task",
    });
  }
});

// Start server and auto-initialize agent
const server = app.listen(PORT, async () => {
  logger.info(`Background Agent Service running on port ${PORT}`);
  logger.info(`Configuration: ${JSON.stringify(agentConfig, null, 2)}`);

  try {
    // Auto-start the agent if configured
    if (agentConfig.autoStart) {
      logger.info("Auto-starting background agent...");
      await backgroundAgent.start();
      logger.info("Background agent auto-started successfully");
    }

    // Auto-start the dynamic scheduler
    logger.info("Auto-starting dynamic scheduler...");
    await dynamicScheduler.start();
    logger.info("Dynamic scheduler auto-started successfully");

    // Log startup success
    logger.info("🚀 Background Agent Service fully initialized and ready!");
    logger.info(
      `📊 Auto-processing: ${
        agentConfig.autoProcessExistingInstruments ? "ENABLED" : "DISABLED"
      }`
    );
    logger.info(
      `⚡ Dynamic Scheduling: ENABLED with ${
        Object.keys(dynamicSchedulerConfig.assetClassFrequencies).length
      } asset classes`
    );
  } catch (error) {
    logger.error("Failed to auto-start services:", error);
    logger.warn("Services are available but may need manual start via API");
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close(async () => {
    try {
      await backgroundAgent.stop();
      dynamicScheduler.stop();
      await dynamicScheduler.cleanup();
      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Add global error handlers to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  // For uncaught exceptions, we should exit
  process.exit(1);
});
