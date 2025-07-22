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
  RotateCcw
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

export default function MarketIntelligencePage() {
  const [selectedInsightType, setSelectedInsightType] = useState('ALL')
  const [selectedDocumentType, setSelectedDocumentType] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch comprehensive intelligence data
  const { data: intelligenceData, isLoading, refetch } = useQuery({
    queryKey: ['market-intelligence'],
    queryFn: async () => {
      const response = await fetch('/api/market/intelligence')
      if (!response.ok) throw new Error('Failed to fetch intelligence data')
      return (await response.json()) as IntelligenceData
    },
    refetchInterval: autoRefresh ? 30000 : false,
  })

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
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  const filteredInsights = intelligenceData?.insights?.filter(insight => 
    selectedInsightType === 'ALL' || insight.type === selectedInsightType
  ) || []

  const filteredDocuments = intelligenceData?.documents?.filter(doc => 
    selectedDocumentType === 'ALL' || doc.type === selectedDocumentType
  ) || []

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
                Real-time market analysis powered by AI background agents
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

          {/* Background Agent Status */}
          {intelligenceData?.backgroundAgentStatus && (
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Background Intelligence Agent
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Processing market data and generating insights
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {intelligenceData.backgroundAgentStatus.isRunning ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <Play className="h-3 w-3 mr-1" />
                      Running
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      <Pause className="h-3 w-3 mr-1" />
                      Stopped
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {intelligenceData.backgroundAgentStatus.tasksInQueue}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Tasks in Queue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {intelligenceData.backgroundAgentStatus.tasksProcessing}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Processing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {intelligenceData.backgroundAgentStatus.processedSymbols}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Symbols Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last Update: {formatTimeAgo(intelligenceData.backgroundAgentStatus.lastUpdate)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Market Overview and Sentiment */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Sentiment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Market Sentiment
              </h2>
            </div>
            
            {intelligenceData?.marketOverview?.sentiment && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {intelligenceData.marketOverview.sentiment.overall > 0 ? '+' : ''}{intelligenceData.marketOverview.sentiment.overall.toFixed(1)}
                  </div>
                  <div className={`text-sm font-medium ${
                    intelligenceData.marketOverview.sentiment.overall > 20 ? 'text-green-600' :
                    intelligenceData.marketOverview.sentiment.overall < -20 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {intelligenceData.marketOverview.sentiment.overall > 20 ? 'Very Bullish' :
                     intelligenceData.marketOverview.sentiment.overall > 0 ? 'Bullish' :
                     intelligenceData.marketOverview.sentiment.overall > -20 ? 'Bearish' : 'Very Bearish'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Bullish</span>
                    <span>{intelligenceData.marketOverview.sentiment.bullish.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${intelligenceData.marketOverview.sentiment.bullish}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Bearish</span>
                    <span>{intelligenceData.marketOverview.sentiment.bearish.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${intelligenceData.marketOverview.sentiment.bearish}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Neutral</span>
                    <span>{intelligenceData.marketOverview.sentiment.neutral.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gray-500 h-2 rounded-full" 
                      style={{ width: `${intelligenceData.marketOverview.sentiment.neutral}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Gainers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Gainers
              </h2>
            </div>
            
            <div className="space-y-3">
              {intelligenceData?.marketOverview?.topMovers?.gainers?.slice(0, 5).map((gainer) => (
                <div key={gainer.symbol} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {gainer.symbol}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {gainer.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-600 dark:text-green-400 font-medium">
                      +{gainer.changePercent.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${gainer.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Losers
              </h2>
            </div>
            
            <div className="space-y-3">
              {intelligenceData?.marketOverview?.topMovers?.losers?.slice(0, 5).map((loser) => (
                <div key={loser.symbol} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {loser.symbol}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {loser.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-600 dark:text-red-400 font-medium">
                      {loser.changePercent.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${loser.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights and Recent News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Insights */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI-Generated Insights
                  </h2>
                </div>
                <select
                  value={selectedInsightType}
                  onChange={(e) => setSelectedInsightType(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Types</option>
                  <option value="OPPORTUNITY">Opportunities</option>
                  <option value="RISK">Risks</option>
                  <option value="TREND">Trends</option>
                  <option value="EVENT">Events</option>
                </select>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredInsights.map((insight) => (
                  <div key={insight.id} className={`rounded-lg p-4 border ${getInsightColor(insight.type)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <span className="text-sm font-medium">{insight.type}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(insight.generatedAt)}
                      </span>
                    </div>
                    
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      {insight.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {insight.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </span>
                      <span className={`px-2 py-1 rounded ${
                        insight.impact === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        insight.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {insight.impact} Impact
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent News */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Newspaper className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Latest News & Analysis
                </h2>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {intelligenceData?.news?.map((article) => (
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
            </div>
          </div>
        </div>

        {/* Processed Documents */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recently Processed Documents
                </h2>
              </div>
              <select
                value={selectedDocumentType}
                onChange={(e) => setSelectedDocumentType(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="ALL">All Types</option>
                <option value="EARNINGS">Earnings</option>
                <option value="SEC_FILING">SEC Filings</option>
                <option value="ANALYST_REPORT">Analyst Reports</option>
                <option value="NEWS">News</option>
              </select>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getDocumentIcon(document.type)}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {document.symbol}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      document.processed 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {document.processed ? 'Processed' : 'Processing'}
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {document.title}
                  </h3>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {formatTimeAgo(document.publishedAt)}
                  </div>
                  
                  {document.keyPoints.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Key Points:</div>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {document.keyPoints.slice(0, 2).map((point, index) => (
                          <li key={index} className="flex items-start">
                            <span className="w-1 h-1 bg-gray-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700"
                  >
                    View Document
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 