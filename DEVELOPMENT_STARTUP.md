# 🚀 Development Environment Startup Guide

This guide ensures a clean startup of the Yobi Trading Platform development environment with proper port management.

## 📋 Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| Frontend | `3000` | Next.js React application |
| API Gateway | `3002` | Express.js API server |
| Data Collector | `3004` | Market data collection service |
| Background Agent | `3009` | AI-powered background processing |
| SearXNG | `8080` | Search engine service |
| PostgreSQL | `5432` | Database (if running locally) |
| Redis | `6379` | Cache and queue (if running locally) |

## 🛠️ Startup Options

### Option 1: Clean Startup (Recommended)
Automatically cleans ports and starts all services:

```bash
pnpm dev
```

This runs:
1. **Port cleanup** - Kills any processes on required ports
2. **SearXNG startup** - Starts Docker containers
3. **Service startup** - Starts all 4 main services in parallel

### Option 2: Manual Port Cleanup
If you want to clean ports manually first:

```bash
# Clean all ports
pnpm run clean:ports

# Then start services
pnpm run dev
```

### Option 3: Fresh Development Start
Complete fresh start with explicit steps:

```bash
# Clean ports + start containers + start services
pnpm run dev:fresh
```

### Option 4: Individual Service Control
Start services individually for debugging:

```bash
# Frontend only
pnpm run dev:frontend

# API Gateway only  
pnpm run dev:api

# Data Collector only
pnpm run dev:collector

# Background Agent only
pnpm run dev:agent
```

## 🔧 Port Conflict Resolution

### Automatic Resolution
The `scripts/cleanup-ports.sh` script automatically:
- ✅ Identifies processes using required ports
- ✅ Safely terminates conflicting processes  
- ✅ Verifies ports are freed
- ✅ Cleans up lingering Node.js processes

### Manual Resolution
If you encounter port conflicts:

```bash
# Check what's using a specific port
lsof -ti:3002

# Kill specific process
kill -9 <PID>

# Or use our cleanup script
bash scripts/cleanup-ports.sh
```

## 🎯 Service Health Checks

After startup, verify services are running:

### Health Check URLs
- **Data Collector**: http://localhost:3004/health
- **API Gateway**: http://localhost:3002/health  
- **Frontend**: http://localhost:3000
- **Background Agent**: http://localhost:3009/health
- **SearXNG**: http://localhost:8080

### Quick Health Check
```bash
# Check all service ports
for port in 3000 3002 3004 3009 8080; do
  if lsof -ti:$port > /dev/null; then
    echo "✅ Port $port is active"
  else
    echo "❌ Port $port is inactive"
  fi
done
```

## 🛑 Stopping Services

### Stop All Services
```bash
# Stop turbo and docker containers
pnpm run stop

# Or use Ctrl+C in the terminal running pnpm dev
```

### Stop Individual Services
```bash
# Stop specific service by port
kill -9 $(lsof -ti:3004)  # Stop data collector
```

## 🏗️ Database Setup

### First Time Setup
```bash
# Run database migrations
pnpm run db:migrate

# Seed with 1000+ instruments
pnpm run seed:instruments
```

### Database Commands
```bash
# Generate Prisma client
pnpm run db:generate

# Push schema changes
pnpm run db:push

# Setup TimescaleDB
pnpm run db:timescale:setup
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Solution: Run port cleanup
   pnpm run clean:ports
   ```

2. **Docker Containers Not Starting**
   ```bash
   # Check Docker status
   docker ps
   
   # Restart containers
   docker-compose -f apps/trading-platform/searxng/docker-compose.yml restart
   ```

3. **Service Won't Start**
   ```bash
   # Check individual service
   cd apps/trading-platform/api-gateway
   pnpm run dev
   ```

4. **Database Connection Issues**
   ```bash
   # Check database health
   pnpm run db:timescale:health
   ```

### Service-Specific Debugging

#### Data Collector Issues
```bash
cd apps/trading-platform/data-collector
pnpm run dev  # Should start on port 3004
```

#### API Gateway Issues  
```bash
cd apps/trading-platform/api-gateway
pnpm run dev  # Should start on port 3002
```

#### Background Agent Issues
```bash
cd apps/trading-platform/background-agent  
pnpm run dev  # Should start on port 3009
```

## 📊 Development Workflow

### Typical Development Session
1. **Clean Start**: `pnpm dev`
2. **Code Changes**: Services auto-reload on file changes
3. **Database Changes**: Run `pnpm run db:push` if needed
4. **Add Instruments**: Use the dynamic discovery system or `pnpm run seed:instruments`
5. **Stop**: `Ctrl+C` or `pnpm run stop`

### Best Practices
- ✅ Always use `pnpm dev` for clean startup
- ✅ Check service health endpoints after startup
- ✅ Use individual service commands for debugging
- ✅ Run port cleanup if you see EADDRINUSE errors
- ✅ Keep Docker Desktop running for SearXNG

## 🎉 Success Indicators

When everything is working correctly, you should see:

```
✅ Port cleanup completed
✅ SearXNG containers running  
✅ All 4 services started successfully
✅ Frontend accessible at http://localhost:3000
✅ API Gateway responding on port 3002
✅ Data Collector active on port 3004
✅ Background Agent processing on port 3009
```

**Ready to develop! 🚀** 