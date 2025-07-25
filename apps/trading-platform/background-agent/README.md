# Background AI Agent Service

## Overview

The Background AI Agent Service is an intelligent automation system that **dynamically schedules** financial data collection and analysis based on instrument characteristics. Instead of fixed hourly schedules, it now adapts refresh frequencies based on asset class, trading volume, market cap, and market conditions.

## 🚀 **NEW: Dynamic Scheduling System**

The agent now features **intelligent, per-instrument scheduling** that replaces fixed cron jobs:

- ✅ **Asset Class-Based Frequencies**: Different update intervals for stocks, ETFs, crypto, etc.
- ✅ **Volume-Sensitive Scheduling**: High-volume instruments get more frequent updates
- ✅ **Market Cap Adjustments**: Large caps monitored more frequently
- ✅ **Exchange-Aware Timing**: Timezone and market hours consideration
- ✅ **Real-Time Adaptation**: Schedules adjust based on market conditions

### **Dynamic Frequency Rules**

| **Asset Class**      | **Base Frequency** | **Rationale**                          |
| -------------------- | ------------------ | -------------------------------------- |
| **Equities (STOCK)** | Every 5 minutes    | Active trading, frequent price changes |
| **Crypto**           | Every 1 minute     | 24/7 trading, high volatility          |
| **ETFs**             | Daily              | Lower volatility, tracks baskets       |
| **Mutual Funds**     | Daily              | Calculated once daily (NAV)            |
| **Commodities**      | Every 15 minutes   | Moderate volatility                    |
| **Forex**            | Every 5 minutes    | Active global trading                  |
| **Bonds**            | Every hour         | Low volatility, interest-sensitive     |

### **Volume-Based Multipliers**

- **Very High Volume** (>10M): **2x more frequent** (0.5x multiplier)
- **High Volume** (1M-10M): **1.33x more frequent** (0.75x multiplier)
- **Medium Volume** (100K-1M): **Base frequency** (1.0x multiplier)
- **Low Volume** (<100K): **2x less frequent** (2.0x multiplier)

### **Market Cap Adjustments**

- **Large Cap** (>$10B): Slightly more frequent (0.8x multiplier)
- **Mid Cap** ($2B-$10B): Base frequency (1.0x multiplier)
- **Small Cap** ($300M-$2B): Slightly less frequent (1.2x multiplier)
- **Micro Cap** (<$300M): Less frequent (1.5x multiplier)

## Features

### 🎯 **Intelligent Task Distribution**

- **Company Analysis**: High-frequency instruments (≤5 min intervals)
- **Insight Generation**: Medium-frequency instruments (6-60 min intervals)
- **Document Discovery**: Low-frequency instruments (>60 min intervals)

### 🕐 **Market Hours Awareness**

- **Pre-Market** (4:00-9:30 AM): 1.5x less frequent
- **Regular Hours** (9:30 AM-4:00 PM): Normal frequency
- **After Hours** (4:00-8:00 PM): 1.3x less frequent
- **Market Closed**: 3x less frequent

### 📊 **Real-Time Monitoring**

- Live instrument scheduling status
- Dynamic frequency calculations
- Volume and market cap-based adjustments
- Exchange-specific timezone handling

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
   # Edit .env with your API keys and scheduling preferences
   ```

## Configuration

### Dynamic Scheduling Configuration

Add these to your `.env` file to customize scheduling:

```env
# Enable dynamic scheduling
ENABLE_DYNAMIC_SCHEDULING=true

# Asset class frequencies (in minutes)
STOCK_FREQUENCY=5                    # Equities: every 5 minutes
ETF_FREQUENCY=1440                   # ETFs: daily
MUTUAL_FUND_FREQUENCY=1440           # Mutual funds: daily
CRYPTO_FREQUENCY=1                   # Crypto: every minute
COMMODITY_FREQUENCY=15               # Commodities: every 15 minutes
FOREX_FREQUENCY=5                    # Forex: every 5 minutes
BOND_FREQUENCY=60                    # Bonds: every hour

# Volume-based frequency multipliers (lower = more frequent)
VOLUME_VERY_HIGH_MULTIPLIER=0.5      # >10M volume: 2x more frequent
VOLUME_HIGH_MULTIPLIER=0.75          # 1M-10M volume: 1.33x more frequent
VOLUME_MEDIUM_MULTIPLIER=1.0         # 100K-1M volume: base frequency
VOLUME_LOW_MULTIPLIER=2.0            # <100K volume: 2x less frequent

# Market cap frequency multipliers
LARGE_CAP_MULTIPLIER=0.8             # >$10B: slightly more frequent
MID_CAP_MULTIPLIER=1.0               # $2B-$10B: base frequency
SMALL_CAP_MULTIPLIER=1.2             # $300M-$2B: slightly less frequent
MICRO_CAP_MULTIPLIER=1.5             # <$300M: less frequent
```

### Required API Keys

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
```

## Usage

### Auto-Start with Development (Recommended)

The agent automatically starts with dynamic scheduling:

```bash
# Start all services including background agent
pnpm dev

# The agent will:
# 1. Query database for all active instruments
# 2. Calculate optimal frequency for each instrument
# 3. Create individual schedules based on characteristics
# 4. Continuously adapt to changing market conditions
```

### API Endpoints

#### Dynamic Scheduler Control

- `GET /scheduler/status` - View current scheduling status and breakdown
- `POST /scheduler/start` - Start dynamic scheduler
- `POST /scheduler/stop` - Stop dynamic scheduler
- `POST /scheduler/refresh/:symbol` - Refresh schedule for specific instrument

#### Agent Control

- `GET /agent/status` - Combined agent and scheduler status
- `POST /agent/start` - Start the background agent
- `POST /agent/stop` - Stop the background agent

### Frontend Monitoring

Visit `http://localhost:3000/agent` to:

- View dynamic scheduling breakdown by asset class and frequency
- Monitor real-time processing statistics
- See which instruments are scheduled at what frequencies
- Manually refresh schedules for specific instruments

## Dynamic Scheduling Examples

### Example 1: High-Volume Tech Stock

```
Symbol: AAPL (Apple Inc.)
Asset Class: STOCK
Exchange: NASDAQ
Volume: 45,000,000 (Very High)
Market Cap: $3.2T (Large Cap)

Calculation:
Base Frequency: 5 minutes (STOCK)
Volume Multiplier: 0.5 (Very High Volume)
Market Cap Multiplier: 0.8 (Large Cap)
Final Frequency: 5 × 0.5 × 0.8 = 2 minutes

Result: Apple gets analyzed every 2 minutes during market hours
```

### Example 2: Small-Cap Indian Stock

```
Symbol: RELIANCE
Asset Class: STOCK
Exchange: NSE
Volume: 800,000 (Medium)
Market Cap: $250B (Large Cap)

Calculation:
Base Frequency: 5 minutes (STOCK)
Volume Multiplier: 1.0 (Medium Volume)
Market Cap Multiplier: 0.8 (Large Cap)
Exchange Multiplier: 1.2 (NSE)
Final Frequency: 5 × 1.0 × 0.8 × 1.2 = 5 minutes

Result: Reliance analyzed every 5 minutes
```

### Example 3: Cryptocurrency

```
Symbol: BTC-USD
Asset Class: CRYPTO
Volume: 25,000,000 (Very High)

Calculation:
Base Frequency: 1 minute (CRYPTO)
Volume Multiplier: 0.5 (Very High Volume)
Final Frequency: 1 × 0.5 = 0.5 minutes → 1 minute (minimum)

Result: Bitcoin analyzed every minute (maximum frequency)
```

### Example 4: Bond ETF

```
Symbol: TLT (Treasury Bond ETF)
Asset Class: ETF
Volume: 5,000,000 (High)
Market Cap: $15B (Large Cap)

Calculation:
Base Frequency: 1440 minutes (ETF - daily)
Volume Multiplier: 0.75 (High Volume)
Market Cap Multiplier: 0.8 (Large Cap)
Final Frequency: 1440 × 0.75 × 0.8 = 864 minutes (14.4 hours)

Result: TLT analyzed approximately every 14 hours
```

## Database Integration

The dynamic scheduler automatically queries your database for:

### Instrument Characteristics

- **Asset Class**: STOCK, ETF, MUTUAL_FUND, CRYPTO, etc.
- **Exchange**: NASDAQ, NYSE, NSE, BSE, etc.
- **Market Data**: Recent volume, price changes, volatility
- **Market Cap**: For frequency calculation
- **Last Update**: To prioritize stale data

### Automatic Adaptations

- **Volume Changes**: Schedules adjust as trading volume changes
- **Market Conditions**: Frequencies adapt during high volatility
- **New Instruments**: Automatically included in dynamic scheduling
- **Inactive Instruments**: Removed from scheduling

## Monitoring & Metrics

### Scheduler Status Response

```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "totalInstruments": 847,
    "scheduleBreakdown": {
      "STOCK_2min": 12, // 12 high-frequency stocks
      "STOCK_5min": 156, // 156 regular stocks
      "CRYPTO_1min": 8, // 8 cryptocurrencies
      "ETF_1440min": 23, // 23 ETFs (daily)
      "MUTUAL_FUND_1440min": 15
    },
    "avgFrequency": 127.3 // Average frequency in minutes
  }
}
```

### Real-Time Adjustments

The system continuously monitors and adjusts:

- **Every 30 minutes**: Refresh instrument characteristics
- **Market events**: Increase frequency during earnings, news
- **Performance metrics**: Optimize based on processing success rates

## Migration from Fixed Scheduling

The new system automatically replaces the old fixed cron schedules:

### ❌ **Old Fixed System** (Deprecated)

```
Market Scan: Every weekday at 9 AM
Company Analysis: Every 30 minutes
Document Discovery: Every 3 hours
Insight Generation: 10 AM, 2 PM, 6 PM
```

### ✅ **New Dynamic System**

```
Individual schedules per instrument based on:
- Asset class (stock=5min, crypto=1min, ETF=daily)
- Trading volume (high volume = more frequent)
- Market capitalization (large cap = slightly more frequent)
- Exchange timezone and market hours
```

## Performance Benefits

- **📈 Better Data Quality**: High-activity instruments get fresher data
- **⚡ Resource Efficiency**: Low-activity instruments use fewer resources
- **🎯 Relevant Updates**: Task types match instrument characteristics
- **🌍 Global Markets**: Timezone-aware scheduling for international exchanges
- **📊 Scalable**: Handles thousands of instruments with optimal resource usage

The dynamic scheduling system ensures your most important and active instruments get the most attention while efficiently managing system resources across your entire portfolio.

## Troubleshooting

### Common Issues

1. **No instruments being scheduled**

   - Check database connection
   - Verify instruments have `active: true`
   - Check logs for database query errors

2. **Very high frequency for all instruments**

   - Check volume multiplier configuration
   - Verify market cap data is populated
   - Review asset class classification

3. **Schedules not updating**
   - Ensure scheduler is running: `GET /scheduler/status`
   - Check for Redis connectivity issues
   - Verify database permissions for market data queries
