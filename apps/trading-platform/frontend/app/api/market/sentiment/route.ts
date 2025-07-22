import { NextRequest, NextResponse } from 'next/server'

interface MarketSentiment {
  overall: number
  bullish: number
  bearish: number
  neutral: number
  sources: {
    news: number
    social: number
    analyst: number
  }
  trending: {
    symbol: string
    sentiment: number
    change: number
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'ALL'

    // Mock sentiment data - in a real app, this would come from sentiment analysis APIs
    const baseSentiment: MarketSentiment = {
      overall: 12.5,
      bullish: 45,
      bearish: 28,
      neutral: 27,
      sources: {
        news: 15.2,
        social: 8.7,
        analyst: 14.1
      },
      trending: [
        {
          symbol: 'AAPL',
          sentiment: 78.5,
          change: 5.2
        },
        {
          symbol: 'TSLA',
          sentiment: 34.2,
          change: -12.8
        },
        {
          symbol: 'MSFT',
          sentiment: 82.1,
          change: 3.4
        },
        {
          symbol: 'GOOGL',
          sentiment: 67.9,
          change: 1.7
        },
        {
          symbol: 'NVDA',
          sentiment: 45.3,
          change: -8.9
        },
        {
          symbol: 'AMZN',
          sentiment: 71.2,
          change: 4.1
        },
        {
          symbol: 'META',
          sentiment: 58.6,
          change: -2.3
        },
        {
          symbol: 'NFLX',
          sentiment: 62.4,
          change: 6.7
        },
        {
          symbol: 'RELIANCE',
          sentiment: 75.8,
          change: 8.2
        },
        {
          symbol: 'TCS',
          sentiment: 69.3,
          change: 2.1
        }
      ]
    }

    // Adjust sentiment based on source filter
    let sentiment = { ...baseSentiment }
    
    if (source === 'news') {
      sentiment.overall = baseSentiment.sources.news
      sentiment.bullish = 50
      sentiment.bearish = 25
      sentiment.neutral = 25
    } else if (source === 'social') {
      sentiment.overall = baseSentiment.sources.social
      sentiment.bullish = 40
      sentiment.bearish = 35
      sentiment.neutral = 25
    } else if (source === 'analyst') {
      sentiment.overall = baseSentiment.sources.analyst
      sentiment.bullish = 48
      sentiment.bearish = 26
      sentiment.neutral = 26
    }

    // Add some randomness to simulate real-time changes
    const randomFactor = (Math.random() - 0.5) * 2 // -1 to 1
    sentiment.overall += randomFactor
    sentiment.trending = sentiment.trending.map(item => ({
      ...item,
      sentiment: Math.max(0, Math.min(100, item.sentiment + (Math.random() - 0.5) * 10)),
      change: item.change + (Math.random() - 0.5) * 5
    }))

    return NextResponse.json(sentiment)
  } catch (error) {
    console.error('Error fetching market sentiment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market sentiment' },
      { status: 500 }
    )
  }
} 