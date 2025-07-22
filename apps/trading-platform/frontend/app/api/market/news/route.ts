import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface MarketNews {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  relevance: number
  symbols: string[]
  category: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category') || 'ALL'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Mock news data - in a real app, this would come from news APIs
    const allNews: MarketNews[] = [
      {
        id: '1',
        title: 'Federal Reserve Signals Potential Rate Cuts in 2024',
        summary: 'Fed Chair Powell suggests monetary policy may shift as inflation shows signs of cooling, potentially benefiting growth stocks.',
        url: 'https://example.com/fed-rate-cuts',
        source: 'Reuters',
        publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        sentiment: 'POSITIVE',
        relevance: 0.95,
        symbols: ['SPX', 'IXIC', 'DJI'],
        category: 'MARKET'
      },
      {
        id: '2',
        title: 'Apple Reports Strong Q4 Earnings, Beats Expectations',
        summary: 'AAPL exceeds revenue and EPS forecasts driven by iPhone sales and services growth, shares up 5% in after-hours trading.',
        url: 'https://example.com/apple-earnings',
        source: 'Bloomberg',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.89,
        symbols: ['AAPL'],
        category: 'EARNINGS'
      },
      {
        id: '3',
        title: 'Tesla Faces Production Challenges at Shanghai Factory',
        summary: 'Supply chain disruptions and regulatory requirements slow Tesla production, raising concerns about Q4 delivery targets.',
        url: 'https://example.com/tesla-production',
        source: 'Financial Times',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        sentiment: 'NEGATIVE',
        relevance: 0.78,
        symbols: ['TSLA'],
        category: 'TECH'
      },
      {
        id: '4',
        title: 'Oil Prices Surge on OPEC+ Production Cuts',
        summary: 'Crude oil jumps 3% after OPEC+ announces extended production cuts through Q2 2024, benefiting energy sector stocks.',
        url: 'https://example.com/oil-prices',
        source: 'CNBC',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.85,
        symbols: ['XOM', 'CVX', 'COP'],
        category: 'ENERGY'
      },
      {
        id: '5',
        title: 'Banking Sector Under Pressure from Credit Concerns',
        summary: 'Regional banks face headwinds as commercial real estate loans show signs of stress, KRE index down 2.5%.',
        url: 'https://example.com/banking-pressure',
        source: 'Wall Street Journal',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
        sentiment: 'NEGATIVE',
        relevance: 0.72,
        symbols: ['KRE', 'JPM', 'BAC', 'WFC'],
        category: 'FINANCE'
      },
      {
        id: '6',
        title: 'Microsoft Azure Revenue Growth Accelerates',
        summary: 'Cloud computing division shows 30% YoY growth, driven by AI services adoption and enterprise migration trends.',
        url: 'https://example.com/microsoft-azure',
        source: 'TechCrunch',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), // 10 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.83,
        symbols: ['MSFT'],
        category: 'TECH'
      },
      {
        id: '7',
        title: 'Inflation Data Shows Continued Cooling Trend',
        summary: 'CPI comes in at 3.2% YoY, below expectations of 3.4%, supporting case for dovish Fed policy stance.',
        url: 'https://example.com/inflation-data',
        source: 'MarketWatch',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.92,
        symbols: ['SPX', 'IXIC', 'TLT'],
        category: 'MARKET'
      },
      {
        id: '8',
        title: 'Nvidia Guidance Disappoints Despite Strong Quarter',
        summary: 'NVDA reports record AI chip sales but provides conservative outlook for next quarter, shares fall 4% pre-market.',
        url: 'https://example.com/nvidia-guidance',
        source: 'Yahoo Finance',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(), // 14 hours ago
        sentiment: 'NEGATIVE',
        relevance: 0.87,
        symbols: ['NVDA'],
        category: 'TECH'
      },
      {
        id: '9',
        title: 'Pharmaceutical Sector Sees M&A Activity Pickup',
        summary: 'Several biotech companies report acquisition interest as large pharma seeks to expand drug pipelines.',
        url: 'https://example.com/pharma-ma',
        source: 'Reuters',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(), // 16 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.69,
        symbols: ['JNJ', 'PFE', 'MRK'],
        category: 'MARKET'
      },
      {
        id: '10',
        title: 'Consumer Spending Shows Resilience Despite Concerns',
        summary: 'Retail sales data beats expectations, suggesting consumer demand remains robust heading into holiday season.',
        url: 'https://example.com/consumer-spending',
        source: 'Bloomberg',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
        sentiment: 'POSITIVE',
        relevance: 0.76,
        symbols: ['XRT', 'AMZN', 'WMT', 'TGT'],
        category: 'MARKET'
      }
    ]

    // Filter by category if specified
    let filteredNews = allNews
    if (category !== 'ALL') {
      filteredNews = allNews.filter(news => news.category === category)
    }

    // Sort by relevance and published date
    filteredNews.sort((a, b) => {
      const relevanceDiff = b.relevance - a.relevance
      if (Math.abs(relevanceDiff) > 0.1) {
        return relevanceDiff
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    // Apply limit
    const news = filteredNews.slice(0, limit)

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error fetching market news:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market news' },
      { status: 500 }
    )
  }
} 