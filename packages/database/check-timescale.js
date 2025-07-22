const { PrismaClient } = require('@prisma/client')

async function checkTimescaleDB() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Checking TimescaleDB extension status...\n')
    
    // Check if TimescaleDB extension is installed
    try {
      const extensions = await prisma.$queryRaw`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'timescaledb';
      `
      
      if (extensions.length === 0) {
        console.log('❌ TimescaleDB extension is NOT enabled')
        console.log('📝 Next steps:')
        console.log('   1. Go to Neon console: https://console.neon.tech')
        console.log('   2. Navigate to your project → Database → SQL Editor')
        console.log('   3. Run: CREATE EXTENSION IF NOT EXISTS timescaledb;')
        console.log('   4. Then run: npm run db:timescale:setup')
        return false
      }
      
      console.log('✅ TimescaleDB extension is enabled')
      console.log(`   Version: ${extensions[0].extversion}`)
      
      // Check TimescaleDB version
      try {
        const version = await prisma.$queryRaw`SELECT timescaledb_get_version();`
        console.log(`   Full version: ${version[0].timescaledb_get_version}`)
      } catch (e) {
        console.log('   (Version details not available)')
      }
      
    } catch (error) {
      console.log('❌ Error checking TimescaleDB extension:', error.message)
      return false
    }
    
    // Check hypertables
    try {
      const hypertables = await prisma.$queryRaw`
        SELECT hypertable_name, num_chunks, compression_enabled
        FROM timescaledb_information.hypertables;
      `
      
      console.log(`\n📊 Hypertables found: ${hypertables.length}`)
      
      if (hypertables.length === 0) {
        console.log('⚠️  No hypertables created yet')
        console.log('📝 Next steps:')
        console.log('   1. Run: npm run db:timescale:setup')
        console.log('   2. Then: npm run db:push')
      } else {
        console.log('✅ Hypertables configured:')
        hypertables.forEach(table => {
          console.log(`   • ${table.hypertable_name} (${table.num_chunks} chunks, compression: ${table.compression_enabled ? 'enabled' : 'disabled'})`)
        })
      }
      
    } catch (error) {
      console.log('⚠️  Hypertables not set up yet (this is normal for first run)')
      console.log('📝 Run: npm run db:timescale:setup')
    }
    
    // Check table sizes
    try {
      const tableSizes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE tablename IN ('MarketData', 'technical_indicators', 'portfolio_performance', 'user_activity')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `
      
      if (tableSizes.length > 0) {
        console.log('\n📈 Time-series table sizes:')
        tableSizes.forEach(table => {
          console.log(`   • ${table.tablename}: ${table.size}`)
        })
      }
      
    } catch (error) {
      console.log('ℹ️  Time-series tables not created yet')
    }
    
    console.log('\n🚀 TimescaleDB Status: Ready')
    return true
    
  } catch (error) {
    console.log('❌ Database connection error:', error.message)
    console.log('📝 Make sure your DATABASE_URL is set correctly')
    return false
  } finally {
    await prisma.$disconnect()
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

checkTimescaleDB()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Script error:', error)
    process.exit(1)
  }) 