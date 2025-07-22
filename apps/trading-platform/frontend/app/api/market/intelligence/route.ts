import { NextRequest, NextResponse } from 'next/server'

interface IntelligenceData {
  marketOverview: {
    sentiment: {
      overall: number
      bullish: number
      bearish: number
      neutral: number
    }
    topMovers: {
      gainers: Array<{
        symbol: string
        name: string
        change: number
        changePercent: number
        price: number
      }>
      losers: Array<{
        symbol: string
        name: string
        change: number
        changePercent: number
        price: number
      }>
    }
    sectors: Array<{
      name: string
      change: number
      leaders: string[]
      laggards: string[]
    }>
  }
  news: Array<{
    id: string
    title: string
    summary: string
    url: string
    source: string
    publishedAt: string
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
    symbols: string[]
    category: string
    relevance: number
  }>
  insights: Array<{
    id: string
    symbol: string
    type: 'OPPORTUNITY' | 'RISK' | 'TREND' | 'EVENT'
    title: string
    description: string
    confidence: number
    impact: 'HIGH' | 'MEDIUM' | 'LOW'
    timeframe: string
    dataPoints: string[]
    generatedAt: string
  }>
  documents: Array<{
    id: string
    symbol: string
    title: string
    type: 'EARNINGS' | 'SEC_FILING' | 'ANALYST_REPORT' | 'NEWS'
    url: string
    publishedAt: string
    processed: boolean
    keyPoints: string[]
  }>
  backgroundAgentStatus: {
    isRunning: boolean
    tasksInQueue: number
    tasksProcessing: number
    lastUpdate: string
    processedSymbols: number
    totalSymbols: number
  }
}

export async function GET(request: NextRequest) {
  try {
    // In production, this would connect to the background agent service
    // For now, we'll simulate real-time intelligence data
    
    const currentTime = new Date()
    
    const intelligenceData: IntelligenceData = {
      marketOverview: {
        sentiment: {
          overall: 15.2 + (Math.random() - 0.5) * 10,
          bullish: 48 + Math.random() * 10,
          bearish: 25 + Math.random() * 8,
          neutral: 27 + Math.random() * 5
        },
        topMovers: {
          gainers: [
            {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              change: 5.23,
              changePercent: 2.89,
              price: 189.45
            },
            {
              symbol: 'MSFT',
              name: 'Microsoft Corporation',
              change: 7.12,
              changePercent: 1.95,
              price: 378.92
            },
            {
              symbol: 'NVDA',
              name: 'NVIDIA Corporation',
              change: 12.45,
              changePercent: 2.67,
              price: 478.23
            },
            {
              symbol: 'RELIANCE',
              name: 'Reliance Industries Limited',
              change: 45.67,
              changePercent: 1.87,
              price: 2487.65
            },
            {
              symbol: 'TCS',
              name: 'Tata Consultancy Services',
              change: 32.15,
              changePercent: 0.89,
              price: 3654.23
            }
          ],
          losers: [
            {
              symbol: 'TSLA',
              name: 'Tesla Inc.',
              change: -8.45,
              changePercent: -3.36,
              price: 242.68
            },
            {
              symbol: 'META',
              name: 'Meta Platforms Inc.',
              change: -4.67,
              changePercent: -1.40,
              price: 329.56
            },
            {
              symbol: 'NFLX',
              name: 'Netflix Inc.',
              change: -6.78,
              changePercent: -1.50,
              price: 445.67
            }
          ]
        },
        sectors: [
          {
            name: 'Technology',
            change: 1.85,
            leaders: ['AAPL', 'MSFT', 'NVDA'],
            laggards: ['META', 'NFLX']
          },
          {
            name: 'Healthcare',
            change: 0.95,
            leaders: ['UNH', 'JNJ'],
            laggards: ['ABT']
          },
          {
            name: 'Finance',
            change: -0.45,
            leaders: ['JPM'],
            laggards: ['WFC', 'C']
          }
        ]
      },
      news: [
        {
          id: '1',
          title: 'AI Breakthrough: Apple Announces Revolutionary M4 Chip with Neural Processing',
          summary: 'Apple unveils next-generation M4 chip featuring advanced AI capabilities, expected to boost MacBook and iPad performance significantly.',
          url: 'https://example.com/apple-m4-chip',
          source: 'TechCrunch',
          publishedAt: new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString(),
          sentiment: 'POSITIVE',
          symbols: ['AAPL'],
          category: 'TECH',
          relevance: 0.95
        },
        {
          id: '2',
          title: 'Federal Reserve Signals Dovish Stance as Inflation Continues to Cool',
          summary: 'Fed Chair Powell hints at potential rate cuts in early 2024, citing progress on inflation targets and economic stability.',
          url: 'https://example.com/fed-signals',
          source: 'Reuters',
          publishedAt: new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString(),
          sentiment: 'POSITIVE',
          symbols: ['SPX', 'IXIC'],
          category: 'MARKET',
          relevance: 0.92
        },
        {
          id: '3',
          title: 'Reliance Industries Reports Record Q3 Earnings, Beats Estimates',
          summary: 'RIL announces strong quarterly results driven by robust petrochemicals and retail performance, raising full-year guidance.',
          url: 'https://example.com/reliance-earnings',
          source: 'Economic Times',
          publishedAt: new Date(currentTime.getTime() - 90 * 60 * 1000).toISOString(),
          sentiment: 'POSITIVE',
          symbols: ['RELIANCE'],
          category: 'EARNINGS',
          relevance: 0.88
        },
        {
          id: '4',
          title: 'Tesla Faces Production Headwinds in China Amid Supply Chain Disruptions',
          summary: 'Tesla Shanghai factory reports slower production due to component shortages, potentially impacting Q4 delivery targets.',
          url: 'https://example.com/tesla-production',
          source: 'Financial Times',
          publishedAt: new Date(currentTime.getTime() - 120 * 60 * 1000).toISOString(),
          sentiment: 'NEGATIVE',
          symbols: ['TSLA'],
          category: 'TECH',
          relevance: 0.85
        }
      ],
      insights: [
        {
          id: 'insight_1',
          symbol: 'AAPL',
          type: 'OPPORTUNITY',
          title: 'Apple Shows Strong Technical Momentum',
          description: 'AAPL breaks above key resistance at $185, with strong volume confirmation and positive earnings revision trends.',
          confidence: 0.82,
          impact: 'HIGH',
          timeframe: '1-3 months',
          dataPoints: [
            'RSI at 67.2 (bullish but not overbought)',
            'Volume 20% above average',
            'Analyst upgrades: 3 in past week',
            'Options flow: Heavy call buying'
          ],
          generatedAt: new Date(currentTime.getTime() - 15 * 60 * 1000).toISOString()
        },
        {
          id: 'insight_2',
          symbol: 'TSLA',
          type: 'RISK',
          title: 'Tesla Production Concerns Mount',
          description: 'Multiple supply chain indicators suggest potential delivery miss, with technical indicators turning bearish.',
          confidence: 0.74,
          impact: 'MEDIUM',
          timeframe: '2-6 weeks',
          dataPoints: [
            'Shanghai factory output down 15%',
            'Technical breakdown below $250 support',
            'Insider selling activity increased',
            'Analyst downgrades: 2 this week'
          ],
          generatedAt: new Date(currentTime.getTime() - 45 * 60 * 1000).toISOString()
        },
        {
          id: 'insight_3',
          symbol: 'RELIANCE',
          type: 'TREND',
          title: 'Energy Transition Play Gaining Momentum',
          description: 'Reliance\'s renewable energy investments starting to show returns, with strong ESG investor interest.',
          confidence: 0.78,
          impact: 'HIGH',
          timeframe: '6-12 months',
          dataPoints: [
            'Green energy capex up 40% YoY',
            'Solar panel production scaling rapidly',
            'ESG fund inflows targeting RIL',
            'Government policy support increasing'
          ],
          generatedAt: new Date(currentTime.getTime() - 75 * 60 * 1000).toISOString()
        }
      ],
      documents: [
        {
          id: 'doc_1',
          symbol: 'AAPL',
          title: 'Apple Inc. - Form 10-K Annual Report',
          type: 'SEC_FILING',
          url: 'https://sec.gov/Archives/edgar/data/320193/000032019323000106/aapl-20230930.htm',
          publishedAt: new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          processed: true,
          keyPoints: [
            'Services revenue growth accelerating',
            'Strong cash position for acquisitions',
            'AI investment strategy outlined',
            'Supply chain diversification progress'
          ]
        },
        {
          id: 'doc_2',
          symbol: 'TSLA',
          title: 'Tesla Q3 2024 Earnings Call Transcript',
          type: 'EARNINGS',
          url: 'https://ir.tesla.com/earnings',
          publishedAt: new Date(currentTime.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          processed: true,
          keyPoints: [
            'FSD progress update provided',
            'Cybertruck production challenges',
            'Energy storage business growth',
            'Margin pressure from price cuts'
          ]
        },
        {
          id: 'doc_3',
          symbol: 'RELIANCE',
          title: 'Morgan Stanley Upgrade: RIL to Overweight',
          type: 'ANALYST_REPORT',
          url: 'https://example.com/ms-ril-upgrade',
          publishedAt: new Date(currentTime.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          processed: true,
          keyPoints: [
            'Retail business outperforming',
            'Jio platforms monetization potential',
            'Green energy transition underway',
            'Valuation attractive vs peers'
          ]
        }
      ],
      backgroundAgentStatus: {
        isRunning: true,
        tasksInQueue: Math.floor(Math.random() * 50) + 10,
        tasksProcessing: Math.floor(Math.random() * 5) + 1,
        lastUpdate: new Date(currentTime.getTime() - Math.random() * 300000).toISOString(),
        processedSymbols: 247,
        totalSymbols: 1000
      }
    }

    return NextResponse.json(intelligenceData)
  } catch (error) {
    console.error('Error fetching intelligence data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch intelligence data' },
      { status: 500 }
    )
  }
} 