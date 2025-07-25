'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '@/components/WebSocketProvider'

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
  Minus,
  Zap,
  FileText,
  Lightbulb,
  Target,
  Shield,
  Calendar,
  Users,
  Database,
  Bot,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Filter,
  Search,
  Bell,
  Loader2,
  Sparkles,
  TrendingUp as Growth,
  AlertCircle,
  Info
} from 'lucide-react'

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
        exchange: string
        sector: string
      }>
      losers: Array<{
        symbol: string
        name: string
        change: number
        changePercent: number
        price: number
        exchange: string
        sector: string
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
    targetPrice?: number
    sourcesUsed?: any
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
    source: string
    fileSize: number
  }>
  backgroundAgentStatus: {
    isRunning: boolean
    tasksInQueue: number
    tasksProcessing: number
    lastUpdate: string
    processedSymbols: number
    totalSymbols: number
  }
  metadata: {
    totalInstruments: number
    lastUpdated: string
    dataFreshness: {
      marketData: string
      documents: string
      insights: string
      news: string
    }
  }
}

export default function MarketIntelligencePage() {
  const [selectedInsightType, setSelectedInsightType] = useState('ALL')
  const [selectedDocumentType, setSelectedDocumentType] = useState('ALL')
  const [selectedSentiment, setSelectedSentiment] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h')
  const [viewMode, setViewMode] = useState<'overview' | 'news' | 'insights' | 'documents'>('overview')

  // Get WebSocket connection for real-time updates
  const { subscribe, isConnected } = useWebSocket()

  // Fetch comprehensive intelligence data with real-time updates
  const { data: intelligenceData, isLoading, refetch, error } = useQuery({
    queryKey: ['market-intelligence'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiUrl}/api/market/intelligence`)
      if (!response.ok) throw new Error('Failed to fetch intelligence data')
      const result = await response.json()
      return result.data as IntelligenceData
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 2,
    staleTime: 60000 // Consider data stale after 1 minute
  })

  // Subscribe to real-time market updates
  useEffect(() => {
    if (intelligenceData?.marketOverview?.topMovers) {
      const symbols = [
        ...intelligenceData.marketOverview.topMovers.gainers.map(g => g.symbol),
        ...intelligenceData.marketOverview.topMovers.losers.map(l => l.symbol)
      ].slice(0, 20) // Limit to top 20 for performance
      
      subscribe(symbols, 'quotes')
    }
  }, [intelligenceData, subscribe])

  // Real-time update handler for new intelligence data
  useEffect(() => {
    if (isConnected && autoRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, 60000) // Refresh every minute when connected

      return () => clearInterval(interval)
    }
  }, [isConnected, autoRefresh, refetch])

  const refreshAll = async () => {
    await refetch()
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
      case 'POSITIVE': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800'
      case 'NEGATIVE': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
      case 'NEUTRAL': return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600'
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'OPPORTUNITY': return <Target className="h-5 w-5 text-green-500" />
      case 'RISK': return <Shield className="h-5 w-5 text-red-500" />
      case 'TREND': return <TrendingUp className="h-5 w-5 text-blue-500" />
      case 'EVENT': return <Calendar className="h-5 w-5 text-purple-500" />
      default: return <Lightbulb className="h-5 w-5 text-gray-500" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'OPPORTUNITY': return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800'
      case 'RISK': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
      case 'TREND': return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800'
      case 'EVENT': return 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800'
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:border-gray-600'
    }
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'EARNINGS': return <BarChart3 className="h-4 w-4 text-blue-500" />
      case 'SEC_FILING': return <FileText className="h-4 w-4 text-purple-500" />
      case 'ANALYST_REPORT': return <Users className="h-4 w-4 text-green-500" />
      case 'NEWS': return <Newspaper className="h-4 w-4 text-orange-500" />
      default: return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B`
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`
    return num.toFixed(decimals)
  }

  // Filter data based on search and filters
  const filteredNews = intelligenceData?.news?.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.symbols.some(symbol => symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesSentiment = selectedSentiment === 'ALL' || item.sentiment === selectedSentiment
    return matchesSearch && matchesSentiment
  }) || []

  const filteredInsights = intelligenceData?.insights?.filter(insight => {
    const matchesSearch = !searchQuery || 
      insight.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      insight.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedInsightType === 'ALL' || insight.type === selectedInsightType
    return matchesSearch && matchesType
  }) || []

  const filteredDocuments = intelligenceData?.documents?.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedDocumentType === 'ALL' || doc.type === selectedDocumentType
    return matchesSearch && matchesType
  }) || []

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Failed to Load Market Intelligence
                </h3>
                <p className="text-red-600 dark:text-red-300 mt-1">
                  Unable to fetch market data. Please check your connection and try again.
                </p>
              </div>
            </div>
            <button 
              onClick={refreshAll}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
     
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Market Intelligence
              </h1>
              <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                <div className={`flex items-center mr-4 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${!isConnected ? 'animate-pulse' : ''}`} />
                  {isConnected ? 'Live Data' : 'Offline'}
                </div>
                <Clock className="h-4 w-4 mr-1" />
                <span>
                  Updated {intelligenceData?.metadata?.lastUpdated ? formatTimeAgo(intelligenceData.metadata.lastUpdated) : '--'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {autoRefresh ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                Auto-refresh
              </button>
              
              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && !intelligenceData && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Loading Market Intelligence
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Gathering real-time data and insights...
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {intelligenceData && (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Market Sentiment */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Market Sentiment</p>
                    <p className={`text-2xl font-bold ${
                      intelligenceData.marketOverview.sentiment.overall > 0 ? 'text-green-600' : 
                      intelligenceData.marketOverview.sentiment.overall < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {intelligenceData.marketOverview.sentiment.overall > 0 ? '+' : ''}
                      {intelligenceData.marketOverview.sentiment.overall.toFixed(2)}%
                    </p>
                    <div className="mt-2 flex space-x-4 text-xs">
                      <span className="text-green-600">
                        ↑ {intelligenceData.marketOverview.sentiment.bullish.toFixed(0)}%
                      </span>
                      <span className="text-red-600">
                        ↓ {intelligenceData.marketOverview.sentiment.bearish.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-full ${
                    intelligenceData.marketOverview.sentiment.overall > 0 ? 'bg-green-100 dark:bg-green-900/20' :
                    intelligenceData.marketOverview.sentiment.overall < 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {intelligenceData.marketOverview.sentiment.overall > 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : intelligenceData.marketOverview.sentiment.overall < 0 ? (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    ) : (
                      <Minus className="h-6 w-6 text-gray-600" />
                    )}
                  </div>
                </div>
              </div>

              {/* Active Insights */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">AI Insights</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {intelligenceData.insights.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {intelligenceData.insights.filter(i => i.impact === 'HIGH').length} high impact
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* News & Updates */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Latest News</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {intelligenceData.news.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {intelligenceData.news.filter(n => n.sentiment === 'POSITIVE').length} positive
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                    <Newspaper className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Agent Status */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Agent Status</p>
                    <p className={`text-2xl font-bold ${
                      intelligenceData.backgroundAgentStatus.isRunning ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {intelligenceData.backgroundAgentStatus.isRunning ? 'Active' : 'Idle'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {intelligenceData.backgroundAgentStatus.tasksInQueue} in queue
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${
                    intelligenceData.backgroundAgentStatus.isRunning 
                      ? 'bg-green-100 dark:bg-green-900/20' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Bot className={`h-6 w-6 ${
                      intelligenceData.backgroundAgentStatus.isRunning ? 'text-green-600' : 'text-gray-600'
                    }`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by symbol, company, or keywords..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <select 
                    value={selectedInsightType}
                    onChange={(e) => setSelectedInsightType(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Insights</option>
                    <option value="OPPORTUNITY">Opportunities</option>
                    <option value="RISK">Risks</option>
                    <option value="TREND">Trends</option>
                    <option value="EVENT">Events</option>
                  </select>

                  <select 
                    value={selectedSentiment}
                    onChange={(e) => setSelectedSentiment(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Sentiment</option>
                    <option value="POSITIVE">Positive</option>
                    <option value="NEUTRAL">Neutral</option>
                    <option value="NEGATIVE">Negative</option>
                  </select>

                  <select 
                    value={selectedDocumentType}
                    onChange={(e) => setSelectedDocumentType(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Documents</option>
                    <option value="EARNINGS">Earnings</option>
                    <option value="SEC_FILING">SEC Filings</option>
                    <option value="ANALYST_REPORT">Analyst Reports</option>
                    <option value="NEWS">News</option>
                  </select>
                </div>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="mb-8">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { key: 'overview', label: 'Market Overview', icon: BarChart3 },
                    { key: 'news', label: `Latest News (${filteredNews.length})`, icon: Newspaper },
                    { key: 'insights', label: `AI Insights (${filteredInsights.length})`, icon: Brain },
                    { key: 'documents', label: `Documents (${filteredDocuments.length})`, icon: FileText }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setViewMode(key as any)}
                      className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        viewMode === key
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content Sections */}
            {viewMode === 'overview' && (
              <div className="space-y-8">
                {/* Top Movers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Gainers */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                        Top Gainers
                      </h3>
                      <span className="text-sm text-green-600 font-medium">
                        +{intelligenceData.marketOverview.topMovers.gainers.length} stocks
                      </span>
                    </div>
                    <div className="space-y-3">
                      {intelligenceData.marketOverview.topMovers.gainers.slice(0, 5).map((stock, index) => (
                        <div key={stock.symbol} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-4">
                              #{index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{stock.symbol}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{stock.exchange} • {stock.sector}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">${stock.price.toFixed(2)}</p>
                            <p className="text-sm text-green-600 font-medium">
                              +{stock.changePercent.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Losers */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <TrendingDown className="h-5 w-5 text-red-500 mr-2" />
                        Top Losers
                      </h3>
                      <span className="text-sm text-red-600 font-medium">
                        -{intelligenceData.marketOverview.topMovers.losers.length} stocks
                      </span>
                    </div>
                    <div className="space-y-3">
                      {intelligenceData.marketOverview.topMovers.losers.slice(0, 5).map((stock, index) => (
                        <div key={stock.symbol} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-4">
                              #{index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{stock.symbol}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{stock.exchange} • {stock.sector}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">${stock.price.toFixed(2)}</p>
                            <p className="text-sm text-red-600 font-medium">
                              {stock.changePercent.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sector Performance */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Globe className="h-5 w-5 text-blue-500 mr-2" />
                    Sector Performance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {intelligenceData.marketOverview.sectors.slice(0, 6).map((sector) => (
                      <div key={sector.name} className={`p-4 rounded-lg border ${
                        sector.change > 0 
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' 
                          : sector.change < 0 
                          ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{sector.name}</h4>
                          <span className={`text-sm font-medium ${
                            sector.change > 0 ? 'text-green-600' : sector.change < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {sector.change > 0 ? '+' : ''}{sector.change.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <p>Leaders: {sector.leaders.slice(0, 2).join(', ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* News Section */}
            {viewMode === 'news' && (
              <div className="space-y-4">
                {filteredNews.length === 0 ? (
                  <div className="text-center py-12">
                    <Newspaper className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No news found matching your criteria</p>
                  </div>
                ) : (
                  filteredNews.map((newsItem) => (
                    <div key={newsItem.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {getSentimentIcon(newsItem.sentiment)}
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(newsItem.sentiment)}`}>
                              {newsItem.sentiment}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimeAgo(newsItem.publishedAt)}
                            </span>
                            {newsItem.symbols.length > 0 && (
                              <div className="flex space-x-1">
                                {newsItem.symbols.slice(0, 3).map(symbol => (
                                  <span key={symbol} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                                    {symbol}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {newsItem.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 mb-3">
                            {newsItem.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Source: {newsItem.source}
                            </span>
                            <a
                              href={newsItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                              Read Full Article
                              <ExternalLink className="h-4 w-4 ml-1" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Insights Section */}
            {viewMode === 'insights' && (
              <div className="space-y-4">
                {filteredInsights.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No insights found matching your criteria</p>
                  </div>
                ) : (
                  filteredInsights.map((insight) => (
                    <div key={insight.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {getInsightIcon(insight.type)}
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getInsightColor(insight.type)}`}>
                            {insight.type}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            insight.impact === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                            insight.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                            'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {insight.impact} Impact
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {insight.symbol}
                          </span>
                          {insight.targetPrice && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Target: ${insight.targetPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {insight.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {insight.description}
                      </p>
                      
                      {insight.dataPoints.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Data Points:</h4>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {insight.dataPoints.slice(0, 3).map((point, index) => (
                              <li key={index}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-500 dark:text-gray-400">
                            Confidence: {(insight.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            Timeframe: {insight.timeframe.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Generated {formatTimeAgo(insight.generatedAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Documents Section */}
            {viewMode === 'documents' && (
              <div className="space-y-4">
                {filteredDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No documents found matching your criteria</p>
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                    <div key={doc.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {getDocumentIcon(doc.type)}
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {doc.symbol}
                            </span>
                            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              {doc.type.replace('_', ' ')}
                            </span>
                            {doc.processed && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {doc.title}
                          </h3>
                          
                          {doc.keyPoints.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Points:</h4>
                              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {doc.keyPoints.slice(0, 2).map((point, index) => (
                                  <li key={index}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>Source: {doc.source}</span>
                              <span>Size: {formatNumber(doc.fileSize)} bytes</span>
                              <span>Published: {formatTimeAgo(doc.publishedAt)}</span>
                            </div>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                              View Document
                              <ExternalLink className="h-4 w-4 ml-1" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
} 