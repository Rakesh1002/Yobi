'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import CurrencySelector from '../components/CurrencySelector'

// SVG Icons
const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
)

const TrendingDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.511-5.511-3.182" />
  </svg>
)

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3s-4.5 4.03-4.5 9 2.015 9 4.5 9Zm8.716-6.747c.154-.72.234-1.47.234-2.253 0-.783-.08-1.533-.234-2.253m0 4.506c.154-.72.234-1.47.234-2.253 0-.783-.08-1.533-.234-2.253M15.75 9c.154-.72.234-1.47.234-2.253s-.08-1.533-.234-2.253m0 4.506c.154-.72.234-1.47.234-2.253s-.08-1.533-.234-2.253" />
  </svg>
)

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)

interface InstrumentRanking {
  rank: number
  symbol: string
  name: string
  assetClass: string
  score: number
  signal: string
  expectedReturn: number
  price: number
  change24h: number
  volume: number
  marketCap?: number
  sector: string
  currency?: string // Base currency of the instrument (INR, USD, etc.)
  exchange?: string // Exchange where the instrument is traded (NSE, NASDAQ, etc.)
  lastUpdated: string
  technicalScore: number
  fundamentalScore: number
  momentumScore: number
}

interface DashboardStats {
  totalInstruments: number
  avgScore: number
  strongBuys: number
  buys: number
  holds: number
  sells: number
  strongSells: number
  riskSignals: number
  lastUpdated?: string
}

type ViewMode = 'all' | 'nse' | 'nasdaq'

export default function TradingDashboard() {
  const [selectedExchange, setSelectedExchange] = useState<'ALL' | 'NASDAQ' | 'NSE'>('ALL')
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('ALL')
  const [selectedSignal, setSelectedSignal] = useState<string>('ALL')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const [convertedPrices, setConvertedPrices] = useState<Record<string, number>>({})
  const [isClient, setIsClient] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentRanking | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch rankings based on current view mode
  const { data: rankingsData, refetch, isLoading } = useQuery({
    queryKey: ['rankings', viewMode, selectedExchange, selectedAssetClass, selectedSignal],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Set exchange filter based on view mode
      if (viewMode === 'nse') {
        params.append('exchange', 'NSE')
        params.append('limit', '100')
      } else if (viewMode === 'nasdaq') {
        params.append('exchange', 'NASDAQ')
        params.append('limit', '100')
      } else {
        // For 'all' view, don't filter by exchange but limit to top 100
        params.append('limit', '100')
        if (selectedExchange !== 'ALL') {
          params.append('exchange', selectedExchange)
        }
      }
      
      if (selectedAssetClass !== 'ALL') {
        params.append('assetClass', selectedAssetClass)
      }
      if (selectedSignal !== 'ALL') {
        params.append('signal', selectedSignal)
      }

      const response = await fetch(`/api/rankings?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch rankings')
      }
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch instrument details
  const fetchInstrumentDetails = async (symbol: string) => {
    try {
      const response = await fetch(`/api/instruments/${symbol}`)
      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.error('Failed to fetch instrument details:', error)
    }
    return null
  }

  const handleViewDetails = async (ranking: InstrumentRanking) => {
    setSelectedInstrument(ranking)
    setShowDetailModal(true)
    
    // Fetch additional details
    const details = await fetchInstrumentDetails(ranking.symbol)
    if (details) {
      setSelectedInstrument({ ...ranking, ...details })
    }
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedInstrument(null)
  }

  // Currency conversion helper
  const convertPrice = async (amount: number, fromCurrency: string, toCurrency: string): Promise<number> => {
    try {
      const response = await fetch('/api/currency/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amount, 
          from: fromCurrency.toUpperCase(), 
          to: toCurrency.toUpperCase() 
        })
      })
      const data = await response.json()
      if (data.success) {
        return data.data.convertedAmount
      }
      return amount
    } catch (error) {
      console.error('Currency conversion failed:', error)
      return amount
    }
  }

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const calculateStats = (rankings: InstrumentRanking[]): DashboardStats => {
    if (!rankings.length) {
      return {
        totalInstruments: 0,
        avgScore: 0,
        strongBuys: 0,
        buys: 0,
        holds: 0,
        sells: 0,
        strongSells: 0,
        riskSignals: 0
      }
    }

    const totalScore = rankings.reduce((sum, r) => sum + r.score, 0)
    const signalCounts = rankings.reduce((acc, r) => {
      acc[r.signal] = (acc[r.signal] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalInstruments: rankings.length,
      avgScore: totalScore / rankings.length,
      strongBuys: signalCounts['STRONG_BUY'] || 0,
      buys: signalCounts['BUY'] || 0,
      holds: signalCounts['HOLD'] || 0,
      sells: signalCounts['SELL'] || 0,
      strongSells: signalCounts['STRONG_SELL'] || 0,
      riskSignals: (signalCounts['SELL'] || 0) + (signalCounts['STRONG_SELL'] || 0),
      lastUpdated: rankings[0]?.lastUpdated
    }
  }

  // Convert prices when currency changes
  useEffect(() => {
    const convertAllPrices = async () => {
      if (!rankingsData?.data || selectedCurrency === 'USD') {
        setConvertedPrices({})
        return
      }

      const conversions: Record<string, number> = {}
      for (const ranking of rankingsData.data.slice(0, 20)) { // Convert first 20 for performance
        const originalCurrency = ranking.currency || 'USD' // Use the currency field from the API
        if (originalCurrency !== selectedCurrency) {
          conversions[ranking.symbol] = await convertPrice(ranking.price, originalCurrency, selectedCurrency)
        }
      }
      setConvertedPrices(conversions)
    }

    convertAllPrices()
  }, [selectedCurrency, rankingsData])

  // Filter rankings based on search query
  const allRankings = rankingsData?.data || []
  const filteredRankings = allRankings.filter((ranking: InstrumentRanking) => 
    ranking.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ranking.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const rankings = searchQuery ? filteredRankings : allRankings
  const stats = calculateStats(rankings)

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY': return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'BUY': return 'text-green-600 bg-green-50 dark:text-green-500 dark:bg-green-900/10'
      case 'HOLD': return 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'SELL': return 'text-red-600 bg-red-50 dark:text-red-500 dark:bg-red-900/10'
      case 'STRONG_SELL': return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
    }
  }

  const getDisplayPrice = (ranking: InstrumentRanking) => {
    const originalCurrency = ranking.currency || 'USD' // Use the currency field from the API
    const convertedPrice = convertedPrices[ranking.symbol]
    const price = convertedPrice || ranking.price
    const currency = convertedPrice ? selectedCurrency : originalCurrency
    return formatCurrency(price, currency)
  }

  const getViewModeTitle = () => {
    switch (viewMode) {
      case 'all': return 'Top 100 Overall'
      case 'nse': return 'NSE Top 100'
      case 'nasdaq': return 'NASDAQ Top 100'
      default: return 'Investment Rankings'
    }
  }

  const getViewModeDescription = () => {
    switch (viewMode) {
      case 'all': return `Showing top 100 instruments across all exchanges`
      case 'nse': return `Showing top 100 instruments from National Stock Exchange (India)`
      case 'nasdaq': return `Showing top 100 instruments from NASDAQ (USA)`
      default: return 'Investment rankings'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Trading Intelligence Dashboard
              </h1>
              <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-4 w-4 mr-2" />
                Last updated: {isClient && stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : '--:--:--'}
              </div>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              <CurrencySelector 
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                className="w-full sm:w-auto"
              />
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setViewMode('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === 'all'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                🌍 All Markets (Top 100)
              </button>
              <button
                onClick={() => setViewMode('nse')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === 'nse'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                🇮🇳 NSE Top 100
              </button>
              <button
                onClick={() => setViewMode('nasdaq')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === 'nasdaq'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                🇺🇸 NASDAQ Top 100
              </button>
            </nav>
          </div>
        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <GlobeIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Instruments</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalInstruments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUpIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Score</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.avgScore.toFixed(1)}/100</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Strong Opportunities</p>
                <p className="text-2xl font-semibold text-green-600">{stats.strongBuys + stats.buys}</p>
              </div>
              <div className="text-green-600">
                <TrendingUpIcon className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Risk Signals</p>
                <p className="text-2xl font-semibold text-red-600">{stats.riskSignals}</p>
              </div>
              <div className="text-red-600">
                <TrendingDownIcon className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters - Only show for 'all' view */}
        {viewMode === 'all' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">🔍 Filters:</span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by symbol or name..."
                  className="px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <select 
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value as 'ALL' | 'NASDAQ' | 'NSE')}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Exchanges</option>
                <option value="NASDAQ">🇺🇸 NASDAQ</option>
                <option value="NSE">🇮🇳 NSE</option>
              </select>

              <select 
                value={selectedAssetClass}
                onChange={(e) => setSelectedAssetClass(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Asset Classes</option>
                <option value="STOCK">📈 Stocks</option>
                <option value="ETF">💼 ETFs</option>
                <option value="CRYPTO">₿ Crypto</option>
              </select>

              <select 
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Signals</option>
                <option value="STRONG_BUY">🚀 Strong Buy</option>
                <option value="BUY">📈 Buy</option>
                <option value="HOLD">⏸️ Hold</option>
                <option value="SELL">📉 Sell</option>
                <option value="STRONG_SELL">🔻 Strong Sell</option>
              </select>

              <div className="ml-auto flex items-center text-xs text-gray-500 dark:text-gray-400">
                Currency: <span className="ml-1 font-semibold text-blue-600">{selectedCurrency}</span>
              </div>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getViewModeTitle()}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{getViewModeDescription()}</p>
              </div>
              <ChartBarIcon className="h-6 w-6 text-gray-400" />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading rankings...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No rankings available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      RANK
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SYMBOL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      NAME
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ASSET CLASS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SCORE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SIGNAL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      EXPECTED RETURN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      PRICE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rankings.map((ranking: InstrumentRanking) => (
                    <tr key={`${ranking.symbol}-${ranking.rank}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        #{ranking.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {ranking.symbol}
                          </span>
                          {ranking.exchange && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {ranking.exchange === 'NSE' ? '🇮🇳' : ranking.exchange === 'NASDAQ' ? '🇺🇸' : '🌍'} {ranking.exchange}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                            {ranking.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {ranking.sector}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          STOCK
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2 max-w-[60px]">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(ranking.score, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {ranking.score}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSignalColor(ranking.signal)}`}>
                          {ranking.signal.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <span className={ranking.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {ranking.expectedReturn >= 0 ? '+' : ''}{ranking.expectedReturn.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {getDisplayPrice(ranking)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewDetails(ranking)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Instrument Detail Modal */}
      {showDetailModal && selectedInstrument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedInstrument.symbol}
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                    {selectedInstrument.name}
                  </p>
                  <div className="flex items-center mt-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {selectedInstrument.exchange === 'NSE' ? '🇮🇳' : selectedInstrument.exchange === 'NASDAQ' ? '🇺🇸' : '🌍'} {selectedInstrument.exchange}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedInstrument.sector}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Price and Signal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {getDisplayPrice(selectedInstrument)}
                  </p>
                  <p className={`text-sm ${selectedInstrument.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedInstrument.change24h >= 0 ? '+' : ''}{selectedInstrument.change24h.toFixed(2)}%
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Signal</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(selectedInstrument.signal)}`}>
                    {selectedInstrument.signal.replace('_', ' ')}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Expected Return</p>
                  <p className={`text-xl font-semibold ${selectedInstrument.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedInstrument.expectedReturn >= 0 ? '+' : ''}{selectedInstrument.expectedReturn.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Scores */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis Scores</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Overall Score</span>
                      <span className="font-medium">{selectedInstrument.score}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(selectedInstrument.score, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Technical Score</span>
                      <span className="font-medium">{selectedInstrument.technicalScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(selectedInstrument.technicalScore, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Fundamental Score</span>
                      <span className="font-medium">{selectedInstrument.fundamentalScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(selectedInstrument.fundamentalScore, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Momentum Score</span>
                      <span className="font-medium">{selectedInstrument.momentumScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(selectedInstrument.momentumScore, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Volume and Market Cap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Volume</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedInstrument.volume.toLocaleString()}
                  </p>
                </div>
                {selectedInstrument.marketCap && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Market Cap</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(selectedInstrument.marketCap / 1e9).toFixed(2)}B
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={closeDetailModal}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.open(`https://finance.yahoo.com/quote/${selectedInstrument.symbol}${selectedInstrument.exchange === 'NSE' ? '.NS' : ''}`, '_blank')
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View on Yahoo Finance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 