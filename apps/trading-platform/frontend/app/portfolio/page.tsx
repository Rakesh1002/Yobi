'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket, RealTimePriceDisplay } from '@/components/WebSocketProvider'
import Navigation from '@/components/Navigation'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  PieChart,
  RefreshCw,
  Plus,
  Minus,
  Activity,
  Target,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Globe,
  Loader2,
  ExternalLink,
  Eye,
  Edit3,
  Trash2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { getCurrencyFromExchange } from '@yobi/financial-utils'

interface Position {
  id: string
  symbol: string
  name: string
  quantity: number
  averagePrice: number
  currentPrice: number
  totalValue: number
  totalCost: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  dayChange: number
  dayChangePercent: number
  exchange: string
  sector: string
  weight: number
  lastUpdated: string
}

interface PortfolioSummary {
  id: string
  userId: string
  name: string
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPercent: number
  dayPnL: number
  dayPnLPercent: number
  cashBalance: number
  investedAmount: number
  positions: Position[]
  performance: {
    oneDay: number
    oneWeek: number
    oneMonth: number
    threeMonths: number
    oneYear: number
    inception: number
  }
  analytics: {
    beta: number
    alpha: number
    sharpeRatio: number
    maxDrawdown: number
    volatility: number
    diversificationScore: number
  }
  allocation: {
    sectors: Array<{ name: string; percentage: number; value: number }>
    exchanges: Array<{ name: string; percentage: number; value: number }>
    topHoldings: Array<{ symbol: string; percentage: number; value: number }>
  }
  lastUpdated: string
}

export default function PortfolioPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('demo-portfolio-001')
  const [sortBy, setSortBy] = useState<'weight' | 'pnl' | 'dayChange' | 'symbol'>('weight')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showOnlyProfit, setShowOnlyProfit] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Get WebSocket connection for real-time updates
  const { subscribe, isConnected } = useWebSocket()

  // Fetch portfolio data with real-time integration
  const { data: portfolioData, isLoading, refetch, error } = useQuery({
    queryKey: ['portfolio', selectedPortfolioId],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiUrl}/api/portfolio/${selectedPortfolioId}`)
      if (!response.ok) throw new Error('Failed to fetch portfolio data')
      const result = await response.json()
      return result.data as PortfolioSummary
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 2,
    staleTime: 30000
  })

  // Subscribe to real-time price updates for positions
  useEffect(() => {
    if (portfolioData?.positions) {
      const symbols = portfolioData.positions.map(p => p.symbol)
      subscribe(symbols, 'quotes')
    }
  }, [portfolioData, subscribe])

  // Real-time update handler
  useEffect(() => {
    if (isConnected && autoRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, 60000) // Refresh portfolio every minute

      return () => clearInterval(interval)
    }
  }, [isConnected, autoRefresh, refetch])

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (percentage: number): string => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`
  }

  const formatNumber = (num: number): string => {
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B`
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`
    return num.toFixed(0)
  }

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-600 dark:text-green-400'
    if (change < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-4 w-4" />
    if (change < 0) return <ArrowDownRight className="h-4 w-4" />
    return <Minus className="h-4 w-4" />
  }

  // Sort and filter positions
  const filteredAndSortedPositions = portfolioData?.positions
    .filter(position => !showOnlyProfit || position.unrealizedPnL > 0)
    .sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'weight': return (b.weight - a.weight) * multiplier
        case 'pnl': return (b.unrealizedPnL - a.unrealizedPnL) * multiplier
        case 'dayChange': return (b.dayChange - a.dayChange) * multiplier
        case 'symbol': return a.symbol.localeCompare(b.symbol) * multiplier
        default: return 0
      }
    }) || []

  // Using getCurrencyFromExchange from financial-utils package

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Failed to Load Portfolio
                </h3>
                <p className="text-red-600 dark:text-red-300 mt-1">
                  Unable to fetch portfolio data. Please check your connection and try again.
                </p>
              </div>
            </div>
            <button 
              onClick={() => refetch()}
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
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <PieChart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Portfolio Management
              </h1>
              <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                <div className={`flex items-center mr-4 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${!isConnected ? 'animate-pulse' : ''}`} />
                  {isConnected ? 'Live Prices' : 'Offline'}
                </div>
                <Clock className="h-4 w-4 mr-1" />
                <span>
                  Updated {portfolioData?.lastUpdated ? new Date(portfolioData.lastUpdated).toLocaleTimeString() : '--:--:--'}
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
                <Activity className="h-4 w-4 mr-1" />
                Real-time
              </button>
              
              <button
                onClick={() => refetch()}
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
        {isLoading && !portfolioData && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Loading Portfolio
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Fetching your positions and calculating P&L...
              </p>
            </div>
          </div>
        )}

        {/* Portfolio Summary */}
        {portfolioData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Value */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(portfolioData.totalValue, 'USD')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Cash: {formatCurrency(portfolioData.cashBalance, 'USD')}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Total P&L */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total P&L</p>
                    <p className={`text-2xl font-bold ${getChangeColor(portfolioData.totalPnL)}`}>
                      {formatCurrency(portfolioData.totalPnL, 'USD')}
                    </p>
                    <p className={`text-sm font-medium ${getChangeColor(portfolioData.totalPnLPercent)}`}>
                      {formatPercentage(portfolioData.totalPnLPercent)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${
                    portfolioData.totalPnL > 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                    {portfolioData.totalPnL > 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                </div>
              </div>

              {/* Day P&L */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's P&L</p>
                    <p className={`text-2xl font-bold ${getChangeColor(portfolioData.dayPnL)}`}>
                      {formatCurrency(portfolioData.dayPnL, 'USD')}
                    </p>
                    <p className={`text-sm font-medium ${getChangeColor(portfolioData.dayPnLPercent)}`}>
                      {formatPercentage(portfolioData.dayPnLPercent)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${
                    portfolioData.dayPnL > 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                  }`}>
                    <Activity className={`h-6 w-6 ${
                      portfolioData.dayPnL > 0 ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Risk Metrics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sharpe Ratio</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {portfolioData.analytics.sharpeRatio.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Beta: {portfolioData.analytics.beta.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Chart Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Portfolio Performance
                </h3>
                <div className="flex space-x-4 text-sm">
                  <span className="text-green-600">1D: {formatPercentage(portfolioData.performance.oneDay)}</span>
                  <span className="text-blue-600">1W: {formatPercentage(portfolioData.performance.oneWeek)}</span>
                  <span className="text-purple-600">1M: {formatPercentage(portfolioData.performance.oneMonth)}</span>
                  <span className="text-orange-600">1Y: {formatPercentage(portfolioData.performance.oneYear)}</span>
                </div>
              </div>
              <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Performance chart will be implemented</p>
                </div>
              </div>
            </div>

            {/* Positions Management */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Positions ({portfolioData.positions.length})
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Real-time position tracking with live P&L calculations
                    </p>
                  </div>
                  
                  <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="weight">Sort by Weight</option>
                      <option value="pnl">Sort by P&L</option>
                      <option value="dayChange">Sort by Day Change</option>
                      <option value="symbol">Sort by Symbol</option>
                    </select>
                    
                    <button
                      onClick={() => setShowOnlyProfit(!showOnlyProfit)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        showOnlyProfit
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {showOnlyProfit ? 'Show All' : 'Profitable Only'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Current Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Market Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        P&L
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Day Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAndSortedPositions.map((position) => (
                      <tr key={position.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {position.symbol}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {position.exchange} • {position.sector}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatNumber(position.quantity)} shares
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Avg: {formatCurrency(position.averagePrice, getCurrencyFromExchange(position.exchange))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RealTimePriceDisplay 
                            symbol={position.symbol}
                            className="text-sm font-medium"
                            fallbackPrice={position.currentPrice}
                            fallbackCurrency={getCurrencyFromExchange(position.exchange)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(position.totalValue, getCurrencyFromExchange(position.exchange))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getChangeColor(position.unrealizedPnL)}`}>
                            {formatCurrency(position.unrealizedPnL, getCurrencyFromExchange(position.exchange))}
                          </div>
                          <div className={`text-xs ${getChangeColor(position.unrealizedPnLPercent)}`}>
                            {formatPercentage(position.unrealizedPnLPercent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`flex items-center text-sm font-medium ${getChangeColor(position.dayChange)}`}>
                            {getChangeIcon(position.dayChange)}
                            <span className="ml-1">{formatCurrency(position.dayChange, getCurrencyFromExchange(position.exchange))}</span>
                          </div>
                          <div className={`text-xs ${getChangeColor(position.dayChangePercent)}`}>
                            {formatPercentage(position.dayChangePercent)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2 max-w-[60px]">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(position.weight, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {position.weight.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                          <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAndSortedPositions.length === 0 && (
                <div className="text-center py-12">
                  <PieChart className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {showOnlyProfit ? 'No profitable positions found' : 'No positions in portfolio'}
                  </p>
                </div>
              )}
            </div>

            {/* Allocation Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              {/* Sector Allocation */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sector Allocation
                </h3>
                <div className="space-y-3">
                  {portfolioData.allocation.sectors.slice(0, 5).map((sector, index) => (
                    <div key={sector.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)` }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {sector.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {sector.percentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(sector.value, 'USD')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Holdings */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top Holdings
                </h3>
                <div className="space-y-3">
                  {portfolioData.allocation.topHoldings.slice(0, 5).map((holding, index) => (
                    <div key={holding.symbol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {holding.symbol}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {holding.percentage.toFixed(1)}%
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(holding.value, 'USD')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
} 