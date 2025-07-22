'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart3, Calendar, Target, Shield, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercentage, formatVolume } from '@yobi/financial-utils'

interface InstrumentDetail {
  symbol: string
  name: string
  exchange: string
  price: number
  change24h: number
  volume: number
  marketCap?: number
  sector?: string
  technicalScore: number
  fundamentalScore: number
  momentumScore: number
  totalScore: number
  signal: string
  expectedReturn: number
  recommendation?: {
    action: string
    targetPrice: number
    stopLoss: number
    timeHorizon: string
    confidence: number
    rationale: string
    keyPoints: string[]
    risks: string[]
  }
}

export default function InstrumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string

  // Fetch instrument details
  const { data: instrument, isLoading, error } = useQuery({
    queryKey: ['instrument', symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
      const response = await fetch(`${apiUrl}/api/instruments/${symbol}`)
      if (!response.ok) throw new Error('Failed to fetch instrument details')
      return await response.json() as InstrumentDetail
    },
    enabled: !!symbol,
  })

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY':
        return 'text-green-700 bg-green-100 border-green-200'
      case 'BUY':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'HOLD':
        return 'text-gray-600 bg-gray-100 border-gray-200'
      case 'SELL':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'STRONG_SELL':
        return 'text-red-700 bg-red-100 border-red-200'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !instrument) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Instrument Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The instrument {symbol} could not be found or there was an error loading the data.
            </p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {instrument.symbol}
                  </h1>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {instrument.exchange}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">{instrument.name}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(instrument.price, instrument.exchange === 'NSE' ? 'INR' : 'USD')}
              </div>
              <div className={`flex items-center justify-end ${instrument.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {instrument.change24h >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                <span className="font-medium">
                  {formatPercentage(instrument.change24h)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Key Metrics */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Key Statistics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Key Statistics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Market Cap</div>
                                     <div className="font-semibold text-gray-900 dark:text-white">
                     {instrument.marketCap ? formatCurrency(instrument.marketCap, 'USD') : 'N/A'}
                   </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Volume</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {formatVolume(instrument.volume)}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Target className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Sector</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {instrument.sector || 'N/A'}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Calendar className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Expected Return</div>
                  <div className={`font-semibold ${instrument.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(instrument.expectedReturn)}
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Scores */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Analysis Breakdown
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Technical Score</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{instrument.technicalScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${instrument.technicalScore}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fundamental Score</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{instrument.fundamentalScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${instrument.fundamentalScore}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Momentum Score</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{instrument.momentumScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${instrument.momentumScore}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">Total Score</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">{instrument.totalScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full"
                      style={{ width: `${instrument.totalScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendation */}
            {instrument.recommendation && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  AI-Powered Analysis
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Target Price</div>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(instrument.recommendation.targetPrice, instrument.exchange === 'NSE' ? 'INR' : 'USD')}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Stop Loss</div>
                      <div className="font-semibold text-red-600">
                        {formatCurrency(instrument.recommendation.stopLoss, instrument.exchange === 'NSE' ? 'INR' : 'USD')}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Time Horizon</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {instrument.recommendation.timeHorizon.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
                      <div className="font-semibold text-blue-600">
                        {instrument.recommendation.confidence}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Investment Rationale</h3>
                    <p className="text-blue-800 dark:text-blue-200 text-sm">
                      {instrument.recommendation.rationale}
                    </p>
                  </div>

                  {instrument.recommendation.keyPoints.length > 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">Key Strengths</h3>
                      <ul className="space-y-1">
                        {instrument.recommendation.keyPoints.map((point, index) => (
                          <li key={index} className="text-green-800 dark:text-green-200 text-sm flex items-start">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {instrument.recommendation.risks.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h3 className="font-medium text-red-900 dark:text-red-100 mb-2">Risk Factors</h3>
                      <ul className="space-y-1">
                        {instrument.recommendation.risks.map((risk, index) => (
                          <li key={index} className="text-red-800 dark:text-red-200 text-sm flex items-start">
                            <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Signal & Actions */}
          <div className="space-y-6">
            
            {/* Trading Signal */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Trading Signal
              </h2>
              <div className="text-center">
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold border-2 ${getSignalColor(instrument.signal)}`}>
                  {instrument.signal.replace('_', ' ')}
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {instrument.totalScore}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Overall Score
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <button className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                  Add to Portfolio
                </button>
                <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Add to Watchlist
                </button>
                <button className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
                  Set Alert
                </button>
                <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                  Download Report
                </button>
              </div>
            </div>

            {/* Price Alert */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <Shield className="h-5 w-5 inline mr-2" />
                Risk Summary
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Volatility</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.totalScore > 70 ? 'Low' : instrument.totalScore > 40 ? 'Medium' : 'High'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Market Risk</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.exchange === 'NSE' ? 'Emerging Market' : 'Developed Market'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Liquidity</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.volume > 1000000 ? 'High' : instrument.volume > 100000 ? 'Medium' : 'Low'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 