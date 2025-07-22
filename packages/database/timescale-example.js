const { PrismaClient } = require('@prisma/client')

async function demonstrateTimescaleDB() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🚀 TimescaleDB Trading Platform Demo\n')
    
    // 1. Insert Technical Indicators (Time-series data)
    console.log('📊 1. Inserting technical indicators...')
    const now = new Date()
    
    // RSI data for Apple stock
    await prisma.technicalIndicator.create({
      data: {
        timestamp: now,
        instrumentId: 'AAPL_NASDAQ',
        symbol: 'AAPL',
        indicatorName: 'RSI',
        timeframe: '1D',
        value: 67.5,
        signal: 'NEUTRAL',
        metadata: {
          period: 14,
          overbought: 70,
          oversold: 30
        }
      }
    })
    
    // MACD data for Apple stock
    await prisma.technicalIndicator.create({
      data: {
        timestamp: now,
        instrumentId: 'AAPL_NASDAQ',
        symbol: 'AAPL',
        indicatorName: 'MACD',
        timeframe: '1D',
        value: 2.34,
        signal: 'BUY',
        metadata: {
          macd: 2.34,
          signal: 1.87,
          histogram: 0.47
        }
      }
    })
    
    console.log('   ✅ Technical indicators inserted')
    
    // 2. Track Portfolio Performance (Time-series)
    console.log('\n💼 2. Recording portfolio performance...')
    
    await prisma.portfolioPerformance.create({
      data: {
        timestamp: now,
        portfolioId: 'portfolio_123',
        userId: 'user_123',
        totalValue: 125000.50,
        cashValue: 15000.00,
        investedValue: 110000.50,
        dayPnl: 2500.75,
        totalPnl: 25000.50,
        dayReturnPct: 2.04,
        totalReturnPct: 25.0,
        benchmarkReturn: 18.5,
        alpha: 6.5,
        beta: 0.95,
        sharpeRatio: 1.85,
        maxDrawdown: -8.2,
        positionsCount: 15,
        metadata: {
          lastRebalanced: now.toISOString(),
          riskLevel: 'MODERATE'
        }
      }
    })
    
    console.log('   ✅ Portfolio performance recorded')
    
    // 3. User Activity Tracking
    console.log('\n👤 3. Tracking user activity...')
    
    await prisma.userActivity.create({
      data: {
        timestamp: now,
        userId: 'user_123',
        action: 'PORTFOLIO_VIEW',
        resource: 'portfolio_123',
        details: {
          pageView: '/portfolio/portfolio_123',
          duration: 45000,
          interactions: ['chart_view', 'holdings_expand']
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        sessionId: 'session_abc123'
      }
    })
    
    console.log('   ✅ User activity tracked')
    
    // 4. TimescaleDB Advanced Queries
    console.log('\n⚡ 4. Running TimescaleDB optimized queries...')
    
    // Time-bucketed technical analysis
    const technicalTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', timestamp) as day,
        symbol,
        indicator_name,
        AVG(value) as avg_value,
        COUNT(*) as data_points
      FROM technical_indicators 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY day, symbol, indicator_name
      ORDER BY day DESC, symbol, indicator_name
      LIMIT 10;
    `
    
    console.log(`   📈 Technical trends (last 7 days): ${technicalTrends.length} records`)
    
    // Portfolio performance analytics
    const portfolioAnalytics = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        AVG(total_value) as avg_portfolio_value,
        AVG(day_pnl) as avg_day_pnl,
        AVG(sharpe_ratio) as avg_sharpe_ratio
      FROM portfolio_performance
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 5;
    `
    
    console.log(`   💰 Portfolio analytics (last 24h): ${portfolioAnalytics.length} hour buckets`)
    
    // User engagement metrics
    const userEngagement = await prisma.$queryRaw`
      SELECT 
        action,
        COUNT(*) as action_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_activity
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY action
      ORDER BY action_count DESC;
    `
    
    console.log(`   👥 User engagement (last hour): ${userEngagement.length} action types`)
    
    // 5. Performance Comparison
    console.log('\n🏎️  5. Performance testing...')
    
    const startTime = Date.now()
    const complexQuery = await prisma.$queryRaw`
      WITH hourly_portfolio AS (
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          portfolio_id,
          AVG(total_value) as avg_value,
          AVG(day_pnl) as avg_pnl
        FROM portfolio_performance
        WHERE timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY hour, portfolio_id
      ),
      hourly_activity AS (
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          user_id,
          COUNT(*) as activity_count
        FROM user_activity
        WHERE timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY hour, user_id
      )
      SELECT 
        p.hour,
        COUNT(DISTINCT p.portfolio_id) as active_portfolios,
        AVG(p.avg_value) as avg_portfolio_value,
        SUM(a.activity_count) as total_activity
      FROM hourly_portfolio p
      LEFT JOIN hourly_activity a ON p.hour = a.hour
      GROUP BY p.hour
      ORDER BY p.hour DESC
      LIMIT 10;
    `
    
    const queryTime = Date.now() - startTime
    console.log(`   ⚡ Complex analytics query completed in ${queryTime}ms`)
    console.log(`   📊 Results: ${complexQuery.length} hourly data points`)
    
    console.log('\n🎉 TimescaleDB demonstration completed!')
    console.log('\n📋 Summary:')
    console.log('   ✅ Technical indicators: Time-series storage & analysis')
    console.log('   ✅ Portfolio performance: Historical tracking & analytics') 
    console.log('   ✅ User activity: Behavioral analytics & insights')
    console.log('   ✅ Advanced queries: Multi-table time-series joins')
    console.log(`   ⚡ Performance: Complex query in ${queryTime}ms`)
    
    console.log('\n💡 TimescaleDB Benefits Realized:')
    console.log('   • Automatic time-based partitioning')
    console.log('   • Optimized time-series queries')
    console.log('   • Efficient storage for large datasets')
    console.log('   • PostgreSQL compatibility maintained')
    
  } catch (error) {
    console.error('❌ Error in TimescaleDB demonstration:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

demonstrateTimescaleDB() 