# Trading Platform - Port Configuration

## 🚀 Current Setup (After Cleanup)

### **Active Services**
| Service | Port | URL | Status |
|---------|------|-----|---------|
| **Frontend** | 3000 | http://localhost:3000 | ✅ Running |
| **API Gateway** | 3002 | http://localhost:3002 | ✅ Running |

### **Removed Services**
- ❌ `apps/web` (Port 3000) - Removed template app
- ❌ `apps/docs` (Port 3001) - Removed template app

## 📁 Project Structure (After Cleanup)

```
yobi/
├── apps/
│   └── trading-platform/
│       ├── frontend/          # Next.js dashboard (Port 3000)
│       └── api-gateway/       # Express API (Port 3002)
├── packages/
│   ├── ui/                    # Shared UI components
│   ├── shared-types/          # TypeScript definitions
│   ├── financial-utils/       # Financial calculations
│   ├── database/              # Database clients & schema
│   ├── eslint-config/         # ESLint configuration
│   └── typescript-config/     # TypeScript configuration
```

## 🔗 API Endpoints

### **Available Now**
- **Health Check**: http://localhost:3002/api/health
- **Rankings**: http://localhost:3002/api/rankings

### **Response Examples**

**Health Check**:
```json
{
  "status": "OK",
  "timestamp": "2024-12-XX...",
  "service": "Trading Platform API Gateway"
}
```

**Rankings** (Mock Data):
```json
[
  {
    "rank": 1,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "assetClass": "STOCK",
    "score": 95,
    "signal": "STRONG_BUY",
    "expectedReturn": 12.5,
    "lastUpdated": "2024-12-XX..."
  }
]
```

## 🛠️ Development Commands

```bash
# Start trading platform (frontend + API)
pnpm dev:trading

# Start only frontend
pnpm dev

# Start all services
pnpm dev:all

# Check health
curl http://localhost:3002/api/health

# Test rankings API
curl http://localhost:3002/api/rankings
```

## 🎯 Next Steps

1. **Visit Frontend**: http://localhost:3000
2. **Test API**: http://localhost:3002/api/health
3. **View Dashboard**: The frontend should now connect to the API

## 🔧 Port Conflicts Resolved

✅ **Before**: 
- apps/web (3000), apps/docs (3001), trading-platform (3001) ❌ CONFLICT

✅ **After**:
- trading-platform/frontend (3000) ✅
- trading-platform/api-gateway (3002) ✅

---

**All services are now running without conflicts!** 🎉 