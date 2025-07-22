# Background AI Agent Service

## Overview

The Background AI Agent Service is an intelligent automation system that continuously monitors, collects, and analyzes financial data from multiple sources. It automatically processes existing instruments in your database and provides AI-powered insights for investment analysis.

## 🚀 **NEW: Auto-Start & Database Integration**

The agent now **automatically starts** when you run `pnpm dev` and begins processing all existing instruments in your database:

- ✅ **Auto-starts with development server**
- ✅ **Fetches instruments from database automatically** 
- ✅ **Processes news, SEC filings, earnings transcripts**
- ✅ **Intelligent scheduling** based on market conditions
- ✅ **Queue-based processing** with Redis
- ✅ **Real-time status monitoring**

## Features

### 🔍 **Multi-Provider Web Search**
- **Tavily API**: Latest news and real-time information
- **Exa API**: Deep web search and analysis
- **SERP API**: Google search results and trends
- **Intelligent aggregation** with deduplication and ranking

### 📄 **Document Intelligence**
- **SEC EDGAR Integration**: Automatic 10-K, 10-Q, 8-K filing discovery
- **Earnings Transcripts**: Multi-source transcript collection
- **Company IR Pages**: Automated scraping of investor relations
- **PDF Processing**: Content extraction and analysis
- **News & Research**: Continuous monitoring and collection

### 🧠 **AI-Powered Insights**
- **Claude AI Integration**: Advanced financial analysis
- **Investment Recommendations**: Buy/Hold/Sell with confidence scores
- **Risk Assessment**: Comprehensive risk analysis
- **Executive Summaries**: Automated high-level overviews
- **Data Quality Scoring**: Reliability assessment of sources

### ⚡ **Intelligent Automation**
- **Database-Driven Processing**: Automatically processes all active instruments
- **Market-Aware Scheduling**: Different schedules for market hours, pre/post-market
- **Earnings Calendar Integration**: Automatic processing during earnings seasons
- **News Trend Detection**: Triggers analysis based on news volume
- **Priority Processing**: High-priority tasks during market hours
- **Fallback Support**: Works even when database is unavailable

### 🔄 **Robust Task Management**
- **Redis + Bull Queue**: Scalable task processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Batch Processing**: Configurable batch sizes to prevent overwhelming
- **Status Monitoring**: Real-time queue and processing metrics
- **Health Checks**: Comprehensive service health monitoring

## Installation

1. **Navigate to the service directory**:
   ```bash
   cd apps/trading-platform/background-agent
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

## Configuration

### Required API Keys

Add these to your `.env` file:

```env
# AI Services (Required)
ANTHROPIC_API_KEY="your_claude_api_key"

# Web Search APIs (At least one required)
TAVILY_API_KEY="your_tavily_api_key"
EXA_API_KEY="your_exa_api_key" 
SERP_API_KEY="your_serpapi_key"

# Database & Redis
DATABASE_URL="postgresql://username:password@host:port/database"
REDIS_URL="redis://username:password@host:port"

# Auto-Start Configuration
AUTO_PROCESS_INSTRUMENTS=true
AUTO_START_AGENT=true
AUTO_START_SCHEDULER=true
```

### Scheduler Configuration

The agent includes intelligent scheduling that can be configured via environment variables:

```env
# Enable/disable specific scheduled tasks
ENABLE_MARKET_SCAN=true
ENABLE_COMPANY_ANALYSIS=true
ENABLE_DOCUMENT_DISCOVERY=true
ENABLE_INSIGHT_GENERATION=true
ENABLE_EARNINGS_UPDATES=true
ENABLE_NEWS_MONITORING=true

# Schedule timings (cron format)
MARKET_SCAN_SCHEDULE="0 9 * * 1-5"          # 9 AM weekdays
COMPANY_ANALYSIS_SCHEDULE="*/30 * * * *"     # Every 30 minutes
DOCUMENT_DISCOVERY_SCHEDULE="0 */3 * * *"    # Every 3 hours
INSIGHT_GENERATION_SCHEDULE="0 10,14,18 * * 1-5"  # 10 AM, 2 PM, 6 PM weekdays
NEWS_MONITORING_SCHEDULE="*/20 * * * *"      # Every 20 minutes
```

## Usage

### Auto-Start with Development (Recommended)

The agent automatically starts when you run the development server:

```bash
# Start all services including background agent
pnpm dev

# Or start specific services
pnpm dev:trading  # Includes background agent + frontend + api-gateway
```

The agent will:
1. ✅ **Connect to your database**
2. ✅ **Fetch all active instruments** 
3. ✅ **Begin automated processing** of news, filings, earnings
4. ✅ **Start intelligent scheduler** with market-aware timing
5. ✅ **Provide real-time status** at `http://localhost:3000/agent`

### Manual Start

You can also start the agent independently:

```bash
# Development mode with hot reload
pnpm agent:dev

# Production mode
pnpm agent:start
```

### Frontend Monitoring

Visit `http://localhost:3000/agent` to:
- Monitor real-time agent status
- View processing metrics and queue status
- Manually trigger analysis for specific symbols
- Start/stop the agent and scheduler
- View health status of all services

## API Endpoints

All endpoints are accessible via the API Gateway at `http://localhost:3002/api/agent/`:

### Agent Control
- `GET /health` - Service health check
- `GET /agent/status` - Current agent status
- `POST /agent/start` - Start the agent
- `POST /agent/stop` - Stop the agent

### Manual Triggers
- `POST /search/company/:symbol` - Search for company information
- `POST /fetch/documents/:symbol` - Fetch company documents
- `POST /insights/generate/:symbol` - Generate AI insights

### Scheduler Control
- `GET /scheduler/status` - Scheduler status
- `POST /scheduler/start` - Start scheduler
- `POST /scheduler/stop` - Stop scheduler

### Task Management
- `POST /task/add` - Add custom task to queue

## Database Integration

The agent automatically integrates with your existing database schema:

### Required Tables
- `Instrument` - Active trading instruments
- `MarketData` - Historical market data (optional, for priority ranking)

### Automatic Features
- **Active Instrument Discovery**: Finds all `active: true` instruments
- **Priority Processing**: Prioritizes instruments with recent market data
- **Exchange Filtering**: Focuses on major exchanges (NASDAQ, NSE)
- **Fallback Support**: Uses hardcoded symbols if database unavailable

### Database Service Methods
```typescript
// Get all active instruments
await databaseService.getActiveInstruments()

// Get priority instruments (recent market activity)
await databaseService.getPriorityInstruments(50)

// Get instruments needing document updates
await databaseService.getInstrumentsNeedingDocumentUpdate()

// Get earnings calendar symbols
await databaseService.getEarningsCalendarSymbols()
```

## Scheduling & Automation

The agent includes sophisticated scheduling:

### Market Hours Awareness
- **Pre-market**: 6:30 AM ET - High-priority insights generation
- **Market Hours**: 9:30 AM - 4:00 PM ET - Active monitoring and analysis
- **Post-market**: 4:30 PM ET - Comprehensive company analysis
- **Weekends**: Saturday 10 AM - Deep analysis of all instruments

### Intelligent Task Distribution
- **High-Priority**: Earnings announcements, trending news
- **Medium-Priority**: Regular company analysis updates
- **Low-Priority**: Routine document discovery and market scans

### Processing Batches
- **Market Scan**: 30 instruments per batch
- **Company Analysis**: 15 instruments in parallel
- **Document Discovery**: 10 instruments per session
- **Insight Generation**: 8 instruments (to preserve AI API limits)

## Monitoring

### Health Indicators
- ✅ **Web Search**: Tavily/Exa/SERP API connectivity
- ✅ **Database**: PostgreSQL connection
- ✅ **Redis**: Queue system connectivity
- ✅ **Document Fetcher**: Internal service health
- ✅ **Insights Engine**: AI service availability

### Processing Metrics
- **Queue Status**: Tasks waiting, processing, completed, failed
- **Instrument Progress**: Number processed vs. total
- **Service Uptime**: Real-time status monitoring
- **Last Processing**: Timestamp of most recent activity

## Security

- **API Key Protection**: All sensitive keys in environment variables
- **Database Security**: Prisma ORM with prepared statements
- **Rate Limiting**: Built-in delays to respect API limits
- **Error Handling**: Comprehensive error logging and recovery
- **Non-root Container**: Docker runs as non-privileged user

## Troubleshooting

### Common Issues

**Agent won't start automatically:**
```bash
# Check environment variables
echo $AUTO_START_AGENT
echo $AUTO_PROCESS_INSTRUMENTS

# Check database connection
curl http://localhost:3008/health
```

**No instruments being processed:**
```bash
# Check database connection
curl http://localhost:3008/agent/status

# Verify instruments in database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM Instrument WHERE active = true;"
```

**Queue not processing:**
```bash
# Check Redis connection
redis-cli ping

# Restart agent
curl -X POST http://localhost:3008/agent/stop
curl -X POST http://localhost:3008/agent/start
```

**Missing API responses:**
```bash
# Check API key configuration
curl http://localhost:3008/health

# Test individual APIs
curl -X POST http://localhost:3008/search/company/AAPL
```

### Logs

View real-time logs:
```bash
# Development logs
tail -f apps/trading-platform/background-agent/combined.log

# Error logs
tail -f apps/trading-platform/background-agent/error.log
```

## Dependencies

### Core Services
- **Node.js**: 18+ runtime environment
- **TypeScript**: Type-safe development
- **Express**: HTTP server framework
- **Redis**: Task queue and caching
- **PostgreSQL**: Instrument and market data

### AI & Search
- **Anthropic Claude**: AI insights generation
- **Tavily**: Real-time web search
- **Exa**: Deep web analysis
- **SERP**: Google search integration

### Document Processing
- **Puppeteer**: Web scraping and automation
- **PDF-Parse**: PDF content extraction
- **Cheerio**: HTML parsing and manipulation

### Task Management
- **Bull**: Redis-based job queue
- **node-cron**: Intelligent scheduling
- **Winston**: Comprehensive logging

---

The Background AI Agent Service provides comprehensive automated financial intelligence gathering and analysis, seamlessly integrating with your existing trading platform infrastructure! 🚀 