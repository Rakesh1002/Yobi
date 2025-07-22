"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Popular symbols to seed
const INSTRUMENTS = [
    // Large Cap US Stocks
    { symbol: 'AAPL', name: 'Apple Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Consumer Discretionary' },
    { symbol: 'TSLA', name: 'Tesla Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Consumer Discretionary' },
    { symbol: 'META', name: 'Meta Platforms Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Financial Services' },
    { symbol: 'V', name: 'Visa Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Financial Services' },
    { symbol: 'WMT', name: 'Walmart Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Consumer Staples' },
    { symbol: 'UNH', name: 'UnitedHealth Group Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Healthcare' },
    { symbol: 'PG', name: 'Procter & Gamble Co.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Consumer Staples' },
    { symbol: 'HD', name: 'Home Depot Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Consumer Discretionary' },
    { symbol: 'MA', name: 'Mastercard Inc.', assetClass: client_2.AssetClass.STOCK, exchange: client_2.Exchange.NYSE, sector: 'Financial Services' },
    // ETFs
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: client_2.AssetClass.ETF, exchange: client_2.Exchange.NYSE, sector: 'Diversified' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: client_2.AssetClass.ETF, exchange: client_2.Exchange.NASDAQ, sector: 'Technology' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF', assetClass: client_2.AssetClass.ETF, exchange: client_2.Exchange.NYSE, sector: 'Diversified' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: client_2.AssetClass.ETF, exchange: client_2.Exchange.NYSE, sector: 'Diversified' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: client_2.AssetClass.ETF, exchange: client_2.Exchange.NYSE, sector: 'Commodities' },
];
// Generate realistic but fake market data
function generateMarketData(symbol, basePrice) {
    const now = new Date();
    const data = [];
    // Generate last 30 days of data
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Always include the last 3 days to ensure recent data, otherwise skip weekends
        if (i > 3 && (date.getDay() === 0 || date.getDay() === 6))
            continue;
        // Generate realistic price movement
        const variation = (Math.random() - 0.5) * 0.05; // ±2.5% daily variation
        const dayPrice = basePrice * (1 + variation);
        const dayVariation = dayPrice * 0.02; // 2% intraday range
        const open = dayPrice + (Math.random() - 0.5) * dayVariation;
        const close = dayPrice + (Math.random() - 0.5) * dayVariation;
        const high = Math.max(open, close) + Math.random() * dayVariation * 0.5;
        const low = Math.min(open, close) - Math.random() * dayVariation * 0.5;
        data.push({
            timestamp: date,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
            previousClose: Number((close * 0.99).toFixed(2)),
            volume: BigInt(Math.floor(Math.random() * 50000000) + 1000000), // 1M-50M volume
            value: Number((close * Math.random() * 50000000).toFixed(2)),
            trades: Math.floor(Math.random() * 100000) + 10000,
            vwap: Number(((open + high + low + close) / 4).toFixed(2)),
            change: Number((close - close * 0.99).toFixed(2)),
            changePercent: Number(((close - close * 0.99) / (close * 0.99) * 100).toFixed(2)),
            dayHigh: Number(high.toFixed(2)),
            dayLow: Number(low.toFixed(2)),
            weekHigh52: Number((high * 1.2).toFixed(2)),
            weekLow52: Number((low * 0.8).toFixed(2)),
        });
        basePrice = close; // Use previous close as baseline for next day
    }
    return data;
}
// Generate fundamental data
function generateFundamentalData() {
    return {
        marketCap: Math.random() * 2000000000000, // Up to $2T
        peRatio: 15 + Math.random() * 50, // 15-65 P/E
        pbRatio: 1 + Math.random() * 10, // 1-11 P/B
        debtToEquity: Math.random() * 2, // 0-2 D/E
        roe: Math.random() * 0.3, // 0-30% ROE
        eps: Math.random() * 20, // $0-$20 EPS
        revenue: Math.random() * 500000000000, // Up to $500B
        revenueGrowth: (Math.random() - 0.1) * 0.3, // -10% to +20% growth
        netMargin: Math.random() * 0.25, // 0-25% margin
        dividendYield: Math.random() * 0.05, // 0-5% yield
        beta: 0.5 + Math.random() * 1.5, // 0.5-2.0 beta
        data: {}, // Additional fundamental data as JSON
        lastUpdated: new Date(),
    };
}
async function main() {
    console.log('🌱 Starting database seed...');
    try {
        // Create instruments
        console.log('📊 Creating instruments...');
        for (const instrumentData of INSTRUMENTS) {
            const instrument = await prisma.instrument.upsert({
                where: {
                    symbol_exchange: {
                        symbol: instrumentData.symbol,
                        exchange: instrumentData.exchange
                    }
                },
                update: {},
                create: {
                    symbol: instrumentData.symbol,
                    name: instrumentData.name,
                    assetClass: instrumentData.assetClass,
                    exchange: instrumentData.exchange,
                    sector: instrumentData.sector,
                    currency: 'USD',
                    lotSize: 1,
                    tickSize: 0.01,
                    isActive: true,
                },
            });
            // Generate realistic base prices
            const basePrices = {
                'AAPL': 175, 'MSFT': 350, 'GOOGL': 140, 'AMZN': 145, 'TSLA': 250,
                'META': 300, 'NVDA': 450, 'JPM': 150, 'V': 250, 'WMT': 160,
                'UNH': 500, 'JNJ': 160, 'PG': 155, 'HD': 350, 'MA': 400,
                'SPY': 450, 'QQQ': 380, 'IWM': 200, 'VTI': 240, 'GLD': 190,
            };
            const basePrice = basePrices[instrumentData.symbol] || 100;
            // Generate and insert market data
            const marketDataPoints = generateMarketData(instrumentData.symbol, basePrice);
            // Check if market data already exists for this instrument
            const existingData = await prisma.marketData.findFirst({
                where: { instrumentId: instrument.id }
            });
            if (!existingData) {
                // Only create market data if none exists yet
                for (const dataPoint of marketDataPoints) {
                    await prisma.marketData.create({
                        data: {
                            ...dataPoint,
                            instrumentId: instrument.id,
                        },
                    });
                }
            }
            // Generate and insert fundamental data
            if (instrumentData.assetClass === client_2.AssetClass.STOCK) {
                await prisma.fundamentalData.upsert({
                    where: { instrumentId: instrument.id },
                    update: {},
                    create: {
                        ...generateFundamentalData(),
                        instrumentId: instrument.id,
                    },
                });
            }
            console.log(`✅ Created ${instrumentData.symbol} with market data`);
        }
        console.log('🎉 Database seeded successfully!');
        console.log(`📈 Created ${INSTRUMENTS.length} instruments with historical data`);
    }
    catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
