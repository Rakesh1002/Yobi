'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  TrendingUp, 
  TrendingDown, 
  Newspaper, 
  Brain, 
  BarChart3, 
  Globe, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  DollarSign,
  Volume2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react'

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

export default function MarketIntelligencePage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedSentimentSource, setSelectedSentimentSource] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch market overview
  const { data: marketOverview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['market-overview'],
    queryFn: async () => {
      const response = await fetch('/api/market/overview')
      if (!response.ok) throw new Error('Failed to fetch market overview')
      return response.json() as MarketOverview
    },
    refetchInterval: autoRefresh ? 30000 : false,
  })

  // Fetch market news
  const { data: marketNews, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ['market-news', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory)
      params.append('limit', '20')
      
      const response = await fetch(`/api/market/news?${params}`)
      if (!response.ok) throw new Error('Failed to fetch market news')
      return response.json() as { news: MarketNews[] }
    },
    refetchInterval: autoRefresh ? 60000 : false,
  })

  // Fetch market sentiment
  const { data: marketSentiment, isLoading: sentimentLoading, refetch: refetchSentiment } = useQuery({
    queryKey: ['market-sentiment', selectedSentimentSource],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedSentimentSource !== 'ALL') params.append('source', selectedSentimentSource)
      
      const response = await fetch(`/api/market/sentiment?${params}`)
      if (!response.ok) throw new Error('Failed to fetch market sentiment')
      return response.json() as MarketSentiment
    },
    refetchInterval: autoRefresh ? 45000 : false,
  })

  // Fetch technical indicators
  const { data: technicalIndicators, isLoading: technicalLoading, refetch: refetchTechnical } = useQuery({
    queryKey: ['technical-indicators', selectedTimeframe],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('timeframe', selectedTimeframe)
      params.append('limit', '10')
      
      const response = await fetch(`/api/market/technical?${params}`)
      if (!response.ok) throw new Error('Failed to fetch technical indicators')
      return response.json() as { indicators: TechnicalIndicator[] }
    },
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const refreshAll = async () => {
    await Promise.all([
      refetchOverview(),
      refetchNews(),
      refetchSentiment(),
      refetchTechnical()
    ])
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return <ThumbsUp className="h-4 w-4 text-green-500" />
      case 'NEGATIVE': return <ThumbsDown className="h-4 w-4 text-red-500" />
      case 'NEUTRAL': return <Minus className="h-4 w-4 text-gray-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return 'text-green-600 bg-green-50 border-green-200'
      case 'NEGATIVE': return 'text-red-600 bg-red-50 border-red-200'
      case 'NEUTRAL': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Market Intelligence
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Real-time market data, news sentiment, and technical analysis
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Auto-refresh</span>
                </label>
              </div>
              
              <button
                onClick={refreshAll}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {marketOverview?.indices?.map((index) => (
            <div key={index.symbol} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{index.name}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {index.value.toLocaleString()}
                  </p>
                </div>
                <div className={`flex items-center ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {index.change >= 0 ? 
                    <ArrowUpRight className="h-4 w-4" /> : 
                    <ArrowDownRight className="h-4 w-4" />
                  }
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className={`text-sm font-medium ${index.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Market News */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Newspaper className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Market News & Analysis
                    </h2>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="EARNINGS">Earnings</option>
                    <option value="MARKET">Market Updates</option>
                    <option value="TECH">Technology</option>
                    <option value="FINANCE">Finance</option>
                    <option value="ENERGY">Energy</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6">
                {newsLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {marketNews?.news?.map((article) => (
                      <div key={article.id} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              {article.title}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {article.summary}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{article.source}</span>
                              <span>{formatTimeAgo(article.publishedAt)}</span>
                              {article.symbols.length > 0 && (
                                <span className="flex gap-1">
                                  {article.symbols.slice(0, 3).map(symbol => (
                                    <span key={symbol} className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                      {symbol}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${getSentimentColor(article.sentiment)}`}>
                              {getSentimentIcon(article.sentiment)}
                            </span>
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Market Sentiment */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Market Sentiment
                  </h2>
                </div>
              </div>
              
              <div className="p-6">
                {sentimentLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                ) : marketSentiment ? (
                  <div className="space-y-4">
                    {/* Overall Sentiment */}
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {marketSentiment.overall > 0 ? '+' : ''}{marketSentiment.overall.toFixed(1)}
                      </div>
                      <div className={`text-sm font-medium ${
                        marketSentiment.overall > 20 ? 'text-green-600' :
                        marketSentiment.overall < -20 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {marketSentiment.overall > 20 ? 'Very Bullish' :
                         marketSentiment.overall > 0 ? 'Bullish' :
                         marketSentiment.overall > -20 ? 'Bearish' : 'Very Bearish'}
                      </div>
                    </div>

                    {/* Sentiment Breakdown */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Bullish</span>
                        <span>{marketSentiment.bullish}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${marketSentiment.bullish}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Neutral</span>
                        <span>{marketSentiment.neutral}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gray-500 h-2 rounded-full" 
                          style={{ width: `${marketSentiment.neutral}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Bearish</span>
                        <span>{marketSentiment.bearish}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full" 
                          style={{ width: `${marketSentiment.bearish}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Trending Symbols */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Trending Sentiment
                      </h4>
                      <div className="space-y-2">
                        {marketSentiment.trending?.slice(0, 5).map((item) => (
                          <div key={item.symbol} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.symbol}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${
                                item.sentiment > 0 ? 'text-green-600' : 
                                item.sentiment < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {item.sentiment > 0 ? '+' : ''}{item.sentiment.toFixed(1)}
                              </span>
                              <span className={`text-xs ${
                                item.change > 0 ? 'text-green-600' : 
                                item.change < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Technical Indicators */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Technical Signals
                    </h2>
                  </div>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="1D">1 Day</option>
                    <option value="1W">1 Week</option>
                    <option value="1M">1 Month</option>
                    <option value="3M">3 Months</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6">
                {technicalLoading ? (
                  <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {technicalIndicators?.indicators?.map((indicator) => (
                      <div key={indicator.symbol} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {indicator.symbol}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            indicator.macd.signal === 'BUY' ? 'bg-green-100 text-green-800' :
                            indicator.macd.signal === 'SELL' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {indicator.macd.signal}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>RSI: {indicator.rsi.toFixed(1)}</div>
                          <div>Vol: {(indicator.volume / 1000000).toFixed(1)}M</div>
                          <div className={`${indicator.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {indicator.change24h >= 0 ? '+' : ''}{indicator.change24h.toFixed(2)}%
                          </div>
                          <div>Vol: {indicator.volatility.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sector Performance */}
        {marketOverview?.sectors && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sector Performance
                </h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketOverview.sectors.map((sector) => (
                  <div key={sector.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">{sector.name}</h3>
                      <span className={`text-sm font-medium ${
                        sector.change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Volume: {(sector.volume / 1000000).toFixed(1)}M</div>
                      {sector.leaders.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-green-600">Leaders:</span>
                          {sector.leaders.slice(0, 3).map(symbol => (
                            <span key={symbol} className="px-1 bg-green-100 dark:bg-green-900 rounded">
                              {symbol}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 