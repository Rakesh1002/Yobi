'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, TrendingUp, Brain, Target, AlertTriangle } from 'lucide-react'
import EnhancedAnalysis from '@/components/EnhancedAnalysis'

function AnalysisContent() {
  const searchParams = useSearchParams()
  const [selectedSymbol, setSelectedSymbol] = useState(searchParams.get('symbol') || '')
  const [enableKnowledge, setEnableKnowledge] = useState(true)

  const popularSymbols = [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Enhanced AI Analysis
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Professional investment analysis powered by CFA frameworks and financial knowledge
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter symbol (e.g., AAPL, RELIANCE)"
                  className="pl-10 pr-4 py-2 w-64 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enableKnowledge}
                  onChange={(e) => setEnableKnowledge(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Enable Knowledge Base
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedSymbol ? (
          <div className="space-y-6">
            {/* Analysis Options Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-4">
                <Brain className="h-8 w-8 text-blue-600" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    AI-Enhanced Analysis for {selectedSymbol}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {enableKnowledge 
                      ? 'Using RAG technology with CFA Institute materials and financial research documents'
                      : 'Standard AI analysis without knowledge base enhancement'
                    }
                  </p>
                </div>
                {enableKnowledge && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Knowledge Enhanced
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Component */}
            <EnhancedAnalysis 
              symbol={selectedSymbol} 
              includeKnowledge={enableKnowledge}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            {/* Welcome Section */}
            <div className="max-w-3xl mx-auto">
              <div className="mb-8">
                <Target className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Professional Investment Analysis
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  Get comprehensive AI-powered investment analysis using CFA Institute frameworks 
                  and professional financial research. Enter a stock symbol to begin.
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <Brain className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    RAG-Enhanced AI
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Retrieval-Augmented Generation using financial knowledge base
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    CFA Frameworks
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Professional analysis using CFA Institute methodologies
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Risk Assessment
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Comprehensive risk analysis with mitigation strategies
                  </p>
                </div>
              </div>

              {/* Popular Symbols */}
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Popular Symbols
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {popularSymbols.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelectedSymbol(stock.symbol)}
                      className="text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium text-blue-600 dark:text-blue-400">
                        {stock.symbol}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {stock.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {stock.exchange === 'NSE' ? '🇮🇳' : '🇺🇸'} {stock.exchange}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis Features */}
              <div className="mt-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  What You'll Get
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Executive summary with investment thesis</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Buy/Hold/Sell recommendation with target price</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>CFA-level valuation analysis</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Risk factors and mitigation strategies</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Knowledge-backed insights and citations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Technical and fundamental score breakdown</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading analysis...</p>
        </div>
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  )
} 