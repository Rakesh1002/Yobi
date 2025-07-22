import { NextRequest, NextResponse } from 'next/server'

interface MarketOverview {
  indices: {
    name: string
    symbol: string
    value: number
    change: number
    changePercent: number
  }[]
  sectors: {
    name: string
    change: number
    volume: number
    leaders: string[]
    laggards: string[]
  }[]
  currencies: {
    pair: string
    rate: number
    change: number
  }[]
  commodities: {
    name: string
    price: number
    change: number
    unit: string
  }[]
}

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, this would fetch from multiple data sources
    // For now, we'll return mock data that simulates real market data
    
    const overview: MarketOverview = {
      indices: [
        {
          name: "S&P 500",
          symbol: "SPX",
          value: 4567.89,
          change: 23.45,
          changePercent: 0.52
        },
        {
          name: "NASDAQ",
          symbol: "IXIC",
          value: 14234.56,
          change: -45.67,
          changePercent: -0.32
        },
        {
          name: "Dow Jones",
          symbol: "DJI",
          value: 34567.12,
          change: 156.78,
          changePercent: 0.46
        },
        {
          name: "NIFTY 50",
          symbol: "NIFTY",
          value: 19876.45,
          change: 234.56,
          changePercent: 1.19
        }
      ],
      sectors: [
        {
          name: "Technology",
          change: 1.85,
          volume: 15600000000,
          leaders: ["AAPL", "MSFT", "GOOGL"],
          laggards: ["INTC", "CSCO"]
        },
        {
          name: "Healthcare",
          change: 0.95,
          volume: 8900000000,
          leaders: ["UNH", "JNJ", "PFE"],
          laggards: ["ABT", "AMGN"]
        },
        {
          name: "Finance",
          change: -0.45,
          volume: 12300000000,
          leaders: ["JPM", "BAC"],
          laggards: ["WFC", "C", "GS"]
        },
        {
          name: "Energy",
          change: 2.34,
          volume: 6700000000,
          leaders: ["XOM", "CVX", "COP"],
          laggards: ["SLB", "HAL"]
        },
        {
          name: "Consumer Discretionary",
          change: 0.78,
          volume: 9800000000,
          leaders: ["TSLA", "AMZN", "HD"],
          laggards: ["NKE", "SBUX"]
        },
        {
          name: "Industrials",
          change: -0.23,
          volume: 5400000000,
          leaders: ["CAT", "BA", "GE"],
          laggards: ["UPS", "FDX"]
        }
      ],
      currencies: [
        {
          pair: "EUR/USD",
          rate: 1.0856,
          change: 0.0023
        },
        {
          pair: "GBP/USD",
          rate: 1.2734,
          change: -0.0045
        },
        {
          pair: "USD/JPY",
          rate: 149.85,
          change: 0.67
        },
        {
          pair: "USD/INR",
          rate: 83.25,
          change: 0.15
        }
      ],
      commodities: [
        {
          name: "Gold",
          price: 2034.50,
          change: 15.75,
          unit: "oz"
        },
        {
          name: "Silver",
          price: 24.89,
          change: -0.34,
          unit: "oz"
        },
        {
          name: "Crude Oil (WTI)",
          price: 78.92,
          change: 1.23,
          unit: "bbl"
        },
        {
          name: "Natural Gas",
          price: 2.67,
          change: -0.08,
          unit: "MMBtu"
        }
      ]
    }

    return NextResponse.json(overview)
  } catch (error) {
    console.error('Error fetching market overview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market overview' },
      { status: 500 }
    )
  }
} 