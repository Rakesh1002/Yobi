# 🌍 Multi-Exchange Trading Intelligence Platform

A **comprehensive financial platform** that analyzes and ranks investment opportunities across **NASDAQ** 🇺🇸 and **NSE India** 🇮🇳 using real-time market data, technical analysis, and intelligent scoring algorithms.

## 🚀 **Live Features**

### ✅ **Multi-Exchange Support**
- **🇺🇸 NASDAQ**: 60+ top US stocks (AAPL, MSFT, GOOGL, TSLA, etc.)
- **🇮🇳 NSE India**: 90+ Indian stocks (RELIANCE, TCS, HDFCBANK, INFY, etc.)
- **Real-time quotes** with currency-aware pricing (USD vs INR)
- **Cross-market rankings** and comparisons

### ✅ **Intelligent Dashboard**
- **Live Rankings**: Top 100 opportunities ranked by technical + fundamental scores
- **Exchange Filtering**: View NASDAQ, NSE, or combined rankings
- **Multi-dimensional Filters**: Asset class, signal strength, exchange
- **Real-time Updates**: Auto-refresh every minute during market hours

### ✅ **Technical Analysis**
- **RSI** (Relative Strength Index)
- **Moving Averages** with momentum scoring
- **Volume Analysis** for market strength
- **Price Action** patterns and trends
- **Composite Scoring** (Technical 40% + Fundamental 40% + Momentum 20%)

### ✅ **Smart Data Collection**
- **yfinance Integration**: Free, robust market data source
- **Multi-provider Fallback**: Alpha Vantage, Finnhub, Yahoo Finance
- **Exchange-aware Processing**: Automatic .NS suffix for NSE symbols
- **Scheduled Collection**: Automated data updates during market hours

## 🏗️ **Architecture**

### **Working Services**
```
🌍 Multi-Exchange Trading Platform
├── 🎨 Frontend (Port 3000)          - Next.js Dashboard
├── 📊 API Gateway (Port 3002)       - Express.js Rankings API  
└── 🔄 Data Collector (Port 3004)    - Market Data Pipeline

📦 Shared Packages
├── 🗄️  database/                    - Prisma ORM + Redis + ClickHouse
├── 🔧 financial-utils/              - Calculations & Formatters
├── 📋 shared-types/                 - TypeScript Definitions
└── 🎯 typescript-config/            - Shared TS Config
```

### **Technology Stack**
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, React Query
- **Backend**: Node.js, Express.js, Winston Logging
- **Database**: PostgreSQL (Neon), Redis (Upstash), Prisma ORM
- **Data Sources**: yfinance, Alpha Vantage, Finnhub
- **Infrastructure**: Turborepo, pnpm, TypeScript

## 🚀 **Quick Start**

### **Prerequisites**
```bash
Node.js >= 18
pnpm >= 8
```

### **1. Clone & Install**
```bash
git clone <repo-url>
cd yobi
pnpm install
```

### **2. Environment Setup**
```bash
# Copy environment files
cp apps/trading-platform/frontend/.env.example .env.local
cp apps/trading-platform/api-gateway/.env.example .env
cp apps/trading-platform/data-collector/.env.example .env

# Configure your API keys:
# - Alpha Vantage API key
# - Finnhub API key  
# - Database URLs (Neon PostgreSQL, Upstash Redis)
```

### **3. Database Setup**
```bash
# Generate Prisma client & push schema
pnpm db:generate
pnpm db:push

# Seed with sample data (optional)
cd packages/database && npx prisma db seed
```

### **4. Start Everything**
```bash
# 🚀 Single command starts all services:
pnpm dev

# ✅ Frontend:       http://localhost:3000
# ✅ API Gateway:    http://localhost:3002  
# ✅ Data Collector: http://localhost:3004
```

## 📊 **API Endpoints**

### **Rankings API (Port 3002)**
```bash
# Get all rankings
GET /api/rankings

# Filter by exchange
GET /api/rankings?exchange=NASDAQ
GET /api/rankings?exchange=NSE

# Filter by asset class  
GET /api/rankings?assetClass=STOCK

# Combined filters
GET /api/rankings?exchange=NSE&signal=BUY

# Health check
GET /api/health
```

### **Data Collection API (Port 3004)**
```bash
# Collect specific exchange
POST /collect/nasdaq        # US stocks only
POST /collect/nse          # Indian stocks only
POST /collect/all-exchanges # Both exchanges

# Manual symbols
POST /collect/quotes
Content-Type: application/json
{"symbols": ["AAPL", "RELIANCE", "TCS"]}

# Health check
GET /health
```

## 🔧 **Development Commands**

```bash
# Start full platform
pnpm dev                    # All services (frontend + API + data collector)

# Individual services
pnpm dev:frontend          # Frontend only (port 3000)
pnpm dev:trading          # Frontend + API Gateway
pnpm dev:data-collector   # Data collector only (port 3004)

# Database operations
pnpm db:generate          # Generate Prisma client
pnpm db:push             # Push schema to database
pnpm db:migrate          # Run migrations

# Code quality
pnpm lint                # Lint all packages
pnpm format              # Format code with Prettier
pnpm check-types         # TypeScript type checking

# Build for production
pnpm build               # Build all packages
```

## 🌟 **Key Features in Action**

### **1. Multi-Exchange Rankings**
```typescript
// Live rankings with exchange data
{
  "rank": 1,
  "symbol": "RELIANCE", 
  "name": "Reliance Industries Ltd",
  "exchange": "NSE",
  "price": 2847.50,        // ₹ (INR)
  "currency": "INR",
  "score": 87.5,
  "signal": "BUY"
}
```

### **2. Exchange-Specific Filtering**
- **All Exchanges**: Global opportunity rankings
- **NASDAQ 🇺🇸**: US market focus (prices in USD)
- **NSE 🇮🇳**: Indian market focus (prices in INR)

### **3. Real-time Data Pipeline**
- **Scheduled Collection**: Every 5 minutes during market hours
- **Manual Triggers**: On-demand data refresh
- **Fallback Providers**: Automatic failover between data sources
- **Currency Detection**: Smart USD/INR handling

### **4. Technical Scoring Algorithm**
```javascript
Total Score = (Technical Score × 40%) + 
              (Fundamental Score × 40%) + 
              (Momentum Score × 20%)

Signal = "BUY" if score > 70
Signal = "HOLD" if score 30-70  
Signal = "SELL" if score < 30
```

## 📈 **Database Schema**

### **Core Models**
- **Instrument**: Stock symbols, exchanges, metadata
- **MarketData**: OHLCV data, technical indicators
- **FundamentalData**: Financial ratios, company metrics
- **User**: Authentication, preferences, portfolios

### **Supported Exchanges**
- **NSE** (National Stock Exchange) - India
- **NASDAQ** (Tech-heavy US exchange)
- **NYSE** (New York Stock Exchange) - Ready for expansion
- **BSE** (Bombay Stock Exchange) - Ready for expansion

## 🔮 **Roadmap**

### **Phase 1: Core Platform** ✅ **COMPLETE**
- ✅ Multi-exchange data collection (NASDAQ + NSE)
- ✅ Real-time rankings dashboard
- ✅ Technical analysis scoring
- ✅ Exchange filtering & search

### **Phase 2: Enhanced Analytics** 🚧 **In Progress**
- 🔄 Advanced technical indicators
- 🔄 Fundamental analysis integration
- 🔄 Historical performance tracking
- 🔄 Portfolio simulation

### **Phase 3: Global Expansion** 📋 **Planned**
- 📋 BSE (Bombay Stock Exchange)
- 📋 NYSE (New York Stock Exchange)  
- 📋 TSX (Toronto Stock Exchange)
- 📋 LSE (London Stock Exchange)

### **Phase 4: Advanced Features** 📋 **Planned**
- 📋 AI-powered predictions
- 📋 Options & derivatives analysis
- 📋 Real-time alerts & notifications
- 📋 Social trading features

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**🚀 Built with TypeScript, Next.js, and passion for financial technology!** 