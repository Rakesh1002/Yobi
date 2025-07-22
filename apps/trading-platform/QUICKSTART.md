# Trading Platform - Quick Start Development Guide

## 🚀 Immediate Setup Steps

### 1. Environment Setup (30 minutes)

#### Create `.env.local` files:

**Frontend** (`apps/trading-platform/frontend/.env.local`):
```bash
# Database
DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]/trading_platform

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-min-32-characters

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# API
NEXT_PUBLIC_API_URL=http://localhost:3002

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=trading-platform-docs
```

**Backend** (`apps/trading-platform/api-gateway/.env`):
```bash
# Server
PORT=3002
NODE_ENV=development

# Databases
DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]/trading_platform
MONGODB_URI=mongodb+srv://[user]:[password]@cluster.mongodb.net/trading_platform
UPSTASH_REDIS_REST_URL=https://[your-instance].upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
CLICKHOUSE_HOST=https://[your-instance].clickhouse.cloud

# Auth
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# APIs
ANTHROPIC_API_KEY=your-claude-key
ALPHA_VANTAGE_API_KEY=your-av-key
YAHOO_FINANCE_API_KEY=optional
FINNHUB_API_KEY=your-finnhub-key
```

### 2. Install Dependencies (5 minutes)

```bash
# From root directory
pnpm install

# Generate Prisma client
cd packages/database
pnpm db:generate
```

### 3. Database Setup (10 minutes)

```bash
# Push schema to Neon PostgreSQL
cd packages/database
pnpm db:push

# Optional: Seed with sample data
pnpm db:seed
```

### 4. Start Development Servers (2 minutes)

```bash
# From root directory
# Terminal 1: Start all services
pnpm dev

# Or run specific services:
# Terminal 1: Frontend
pnpm dev --filter=@yobi/trading-frontend

# Terminal 2: API Gateway
pnpm dev --filter=@yobi/api-gateway
```

## 📝 Day 1: Create API Foundation

### Step 1: Create Express Server

Create `apps/trading-platform/api-gateway/src/index.ts`:
```typescript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Import routes (to be created)
import routes from './routes'
import { errorHandler } from './middleware/error'
import { rateLimiter } from './middleware/rateLimit'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}))
app.use(compression())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use('/api', rateLimiter)

// Routes
app.use('/api', routes)

// Error handling
app.use(errorHandler)

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection')
  
  ws.on('message', (message) => {
    // Handle WebSocket messages
    console.log('Received:', message.toString())
  })
  
  ws.on('close', () => {
    console.log('WebSocket connection closed')
  })
})

// Start server
const PORT = process.env.PORT || 3002
server.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`)
})
```

### Step 2: Create Route Structure

Create `apps/trading-platform/api-gateway/src/routes/index.ts`:
```typescript
import { Router } from 'express'
import authRoutes from './auth.routes'
import marketRoutes from './market.routes'
import portfolioRoutes from './portfolio.routes'
import analysisRoutes from './analysis.routes'

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Mount routes
router.use('/auth', authRoutes)
router.use('/market', marketRoutes)
router.use('/portfolio', portfolioRoutes)
router.use('/analysis', analysisRoutes)

export default router
```

### Step 3: Create Auth Routes

Create `apps/trading-platform/api-gateway/src/routes/auth.routes.ts`:
```typescript
import { Router } from 'express'
import { body } from 'express-validator'
import { register, login, refresh, logout } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// Registration
router.post('/register', 
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
  ],
  validate,
  register
)

// Login
router.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
)

// Refresh token
router.post('/refresh', refresh)

// Logout
router.post('/logout', authenticate, logout)

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

export default router
```

## 📋 Day 2: Implement Core Services

### Market Data Service

Create `apps/trading-platform/api-gateway/src/services/market.service.ts`:
```typescript
import axios from 'axios'
import { cache } from '@yobi/database'

export class MarketDataService {
  // Fetch quote from multiple providers with fallback
  async getQuote(symbol: string) {
    // Check cache first
    const cached = await cache.getMarketData(symbol)
    if (cached) return cached

    try {
      // Try primary provider (Alpha Vantage)
      const quote = await this.fetchFromAlphaVantage(symbol)
      
      // Cache for 1 minute
      await cache.setMarketData(symbol, quote, 60)
      
      return quote
    } catch (error) {
      // Fallback to Yahoo Finance
      return this.fetchFromYahoo(symbol)
    }
  }

  private async fetchFromAlphaVantage(symbol: string) {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    })
    
    // Transform response to our format
    return this.transformAlphaVantageQuote(response.data)
  }

  private async fetchFromYahoo(symbol: string) {
    // Yahoo Finance implementation
    // Using yahoo-finance2 package
  }
}

export const marketDataService = new MarketDataService()
```

## 🎯 Day 3: Connect Frontend to API

### Update Frontend API Service

Create `apps/trading-platform/frontend/services/api.service.ts`:
```typescript
import axios from 'axios'
import { InstrumentRanking } from '@yobi/shared-types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const tradingAPI = {
  // Rankings
  async getRankings(filters?: any): Promise<InstrumentRanking[]> {
    const { data } = await api.get('/api/rankings', { params: filters })
    return data
  },

  // Market data
  async getQuote(symbol: string) {
    const { data } = await api.get(`/api/market/quote/${symbol}`)
    return data
  },

  // Portfolio
  async getPortfolios() {
    const { data } = await api.get('/api/portfolio')
    return data
  },

  // Auth
  async login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('accessToken', data.accessToken)
    return data
  },
}
```

## 🔧 Development Tips

### 1. Use These Development Tools

```bash
# Database GUI
- TablePlus or DBeaver for PostgreSQL
- MongoDB Compass for MongoDB
- RedisInsight for Redis

# API Testing
- Postman or Insomnia
- Thunder Client (VS Code extension)

# Monitoring
- Prisma Studio: pnpm prisma studio
```

### 2. Common Commands

```bash
# Reset database
pnpm db:push --force-reset

# Generate types from Prisma
pnpm db:generate

# Check TypeScript errors
pnpm check-types

# Format code
pnpm format
```

### 3. Debugging Tips

1. **Enable detailed logging**:
   ```typescript
   // In development
   if (process.env.NODE_ENV === 'development') {
     console.log('Request:', req.method, req.path, req.body)
   }
   ```

2. **Use VS Code debugger**:
   - Add breakpoints in your code
   - Use "Attach to Node Process" debug configuration

3. **Monitor Redis**:
   ```typescript
   // Check what's in cache
   const keys = await redis.keys('*')
   console.log('Cache keys:', keys)
   ```

## 📊 Sample Data for Testing

Create `packages/database/prisma/seed.ts`:
```typescript
import { prisma } from '../src/prisma'
import bcrypt from 'bcryptjs'

async function seed() {
  // Create test user
  const hashedPassword = await bcrypt.hash('testpassword', 10)
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      username: 'testuser',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'TRADER',
    }
  })

  // Create test instruments
  const instruments = await prisma.instrument.createMany({
    data: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetClass: 'STOCK',
        exchange: 'NASDAQ',
        sector: 'Technology',
        currency: 'USD',
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        assetClass: 'STOCK',
        exchange: 'NASDAQ',
        sector: 'Technology',
        currency: 'USD',
      },
      // Add more test instruments
    ]
  })

  console.log('✅ Database seeded')
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

## 🚨 Common Issues & Solutions

### Issue 1: Database Connection Failed
```bash
# Check connection string format
postgresql://user:password@host:5432/database?sslmode=require

# For Neon, ensure SSL is enabled
```

### Issue 2: CORS Errors
```typescript
// Ensure frontend URL is whitelisted
app.use(cors({
  origin: ['http://localhost:3001', 'https://your-app.vercel.app'],
  credentials: true
}))
```

### Issue 3: TypeScript Errors
```bash
# Regenerate types
pnpm db:generate

# Clear TypeScript cache
rm -rf node_modules/.cache
```

---

**Ready to code?** Start with Day 1 tasks and progressively build the platform! 🚀 