import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TechnicalIndicator {
  symbol: string
  name: string
  price: number
  change24h: number
  rsi: number
  macd: {
    signal: 'BUY' | 'SELL' | 'HOLD'
    value: number
  }
  movingAverages: {
    sma20: number
    sma50: number
    sma200: number
  }
  volume: number
  volatility: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '1D'
    const limit = parseInt(searchParams.get('limit') || '10')

    // Mock technical data - in a real app, this would come from technical analysis APIs
    const baseIndicators: TechnicalIndicator[] = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 189.45,
        change24h: 2.34,
        rsi: 67.2,
        macd: {
          signal: 'BUY',
          value: 1.23
        },
        movingAverages: {
          sma20: 185.67,
          sma50: 179.23,
          sma200: 171.45
        },
        volume: 45230000,
        volatility: 24.5
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        price: 378.92,
        change24h: 1.87,
        rsi: 59.8,
        macd: {
          signal: 'HOLD',
          value: 0.45
        },
        movingAverages: {
          sma20: 376.12,
          sma50: 365.89,
          sma200: 352.34
        },
        volume: 28740000,
        volatility: 22.1
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        price: 141.23,
        change24h: 0.98,
        rsi: 52.4,
        macd: {
          signal: 'HOLD',
          value: -0.12
        },
        movingAverages: {
          sma20: 139.87,
          sma50: 134.56,
          sma200: 129.78
        },
        volume: 31560000,
        volatility: 26.8
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        price: 242.68,
        change24h: -3.45,
        rsi: 35.6,
        macd: {
          signal: 'SELL',
          value: -2.34
        },
        movingAverages: {
          sma20: 248.92,
          sma50: 256.78,
          sma200: 265.45
        },
        volume: 89230000,
        volatility: 45.2
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        price: 478.23,
        change24h: -1.23,
        rsi: 42.1,
        macd: {
          signal: 'SELL',
          value: -1.78
        },
        movingAverages: {
          sma20: 485.67,
          sma50: 492.34,
          sma200: 465.12
        },
        volume: 67450000,
        volatility: 38.9
      },
      {
        symbol: 'AMZN',
        name: 'Amazon.com Inc.',
        price: 151.84,
        change24h: 1.56,
        rsi: 61.3,
        macd: {
          signal: 'BUY',
          value: 0.89
        },
        movingAverages: {
          sma20: 149.23,
          sma50: 145.67,
          sma200: 142.89
        },
        volume: 52340000,
        volatility: 28.7
      },
      {
        symbol: 'META',
        name: 'Meta Platforms Inc.',
        price: 329.56,
        change24h: 0.76,
        rsi: 55.8,
        macd: {
          signal: 'HOLD',
          value: 0.23
        },
        movingAverages: {
          sma20: 327.45,
          sma50: 321.89,
          sma200: 315.67
        },
        volume: 34560000,
        volatility: 32.4
      },
      {
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd.',
        price: 2487.65,
        change24h: 1.89,
        rsi: 64.2,
        macd: {
          signal: 'BUY',
          value: 15.67
        },
        movingAverages: {
          sma20: 2465.34,
          sma50: 2423.78,
          sma200: 2398.92
        },
        volume: 8920000,
        volatility: 18.3
      },
      {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        price: 3654.23,
        change24h: 0.87,
        rsi: 58.9,
        macd: {
          signal: 'HOLD',
          value: 8.45
        },
        movingAverages: {
          sma20: 3642.56,
          sma50: 3612.34,
          sma200: 3578.90
        },
        volume: 1230000,
        volatility: 15.7
      },
      {
        symbol: 'INFY',
        name: 'Infosys Limited',
        price: 1432.78,
        change24h: 1.23,
        rsi: 62.4,
        macd: {
          signal: 'BUY',
          value: 12.34
        },
        movingAverages: {
          sma20: 1425.67,
          sma50: 1398.45,
          sma200: 1378.92
        },
        volume: 2450000,
        volatility: 19.2
      }
    ]

    // Adjust indicators based on timeframe
    let indicators = baseIndicators.map(indicator => {
      const timeframeMultiplier = getTimeframeMultiplier(timeframe)
      
      return {
        ...indicator,
        rsi: Math.max(0, Math.min(100, indicator.rsi + (Math.random() - 0.5) * 10 * timeframeMultiplier)),
        macd: {
          ...indicator.macd,
          value: indicator.macd.value * timeframeMultiplier + (Math.random() - 0.5) * 2
        },
        volatility: Math.max(5, indicator.volatility * timeframeMultiplier),
        change24h: indicator.change24h * timeframeMultiplier + (Math.random() - 0.5) * 5
      }
    })

    // Update MACD signals based on adjusted values
    indicators = indicators.map(indicator => {
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
      
      if (indicator.macd.value > 1 && indicator.rsi < 70) {
        signal = 'BUY'
      } else if (indicator.macd.value < -1 && indicator.rsi > 30) {
        signal = 'SELL'
      }
      
      return {
        ...indicator,
        macd: {
          ...indicator.macd,
          signal
        }
      }
    })

    // Sort by signal strength and volatility
    indicators.sort((a, b) => {
      const signalWeight = { 'BUY': 3, 'SELL': 2, 'HOLD': 1 }
      const aWeight = signalWeight[a.macd.signal] + (Math.abs(a.macd.value) / 10)
      const bWeight = signalWeight[b.macd.signal] + (Math.abs(b.macd.value) / 10)
      return bWeight - aWeight
    })

    // Apply limit
    const finalIndicators = indicators.slice(0, limit)

    return NextResponse.json({ indicators: finalIndicators })
  } catch (error) {
    console.error('Error fetching technical indicators:', error)
    return NextResponse.json(
      { error: 'Failed to fetch technical indicators' },
      { status: 500 }
    )
  }
}

function getTimeframeMultiplier(timeframe: string): number {
  switch (timeframe) {
    case '1D': return 1
    case '1W': return 1.5
    case '1M': return 2
    case '3M': return 3
    default: return 1
  }
} 