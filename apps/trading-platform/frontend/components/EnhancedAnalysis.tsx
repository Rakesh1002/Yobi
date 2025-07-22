'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Shield, 
  BookOpen, 
  Award,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react'

interface EnhancedAnalysisProps {
  symbol: string
  includeKnowledge?: boolean
}

interface CFAFramework {
  name: string
  category: string
  description: string
  application: string
}

interface KnowledgeSource {
  title: string
  source: string
  relevance: number
  excerpt: string
}

interface EnhancedAnalysisData {
  symbol: string
  executiveSummary: string
  recommendation: {
    action: string
    targetPrice: number
    stopLoss: number
    timeHorizon: string
    confidence: number
    rationale: string
  }
  valuation: {
    method: string
    targetPrice: number
    upside: number
    fairValue: number
    priceToValue: number
  }
  cfaFrameworks: CFAFramework[]
  keyInsights: string[]
  risks: {
    keyRiskFactors: string[]
    riskLevel: string
    mitigation: string[]
  }
  technicalAnalysis: {
    trend: string
    support: number
    resistance: number
    momentum: string
  }
  knowledgeUsed: number
  documentSources: KnowledgeSource[]
  enhancedAnalysis: boolean
}

export default function EnhancedAnalysis({ symbol, includeKnowledge = true }: EnhancedAnalysisProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['summary'])
  const [showKnowledgeSources, setShowKnowledgeSources] = useState(false)

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['enhanced-analysis', symbol, includeKnowledge],
    queryFn: async () => {
      const response = await fetch('/api/knowledge/analysis/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          analysisType: 'FUNDAMENTAL',
          includeKnowledge,
          timeHorizon: 'MEDIUM_TERM'
        })
      })
      if (!response.ok) throw new Error('Failed to generate enhanced analysis')
      return response.json()
    },
    enabled: !!symbol,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const getRecommendationColor = (action: string) => {
    switch (action) {
      case 'STRONG_BUY': return 'text-green-700 bg-green-100 border-green-200'
      case 'BUY': return 'text-green-600 bg-green-50 border-green-200'
      case 'HOLD': return 'text-gray-600 bg-gray-100 border-gray-200'
      case 'SELL': return 'text-red-600 bg-red-50 border-red-200'
      case 'STRONG_SELL': return 'text-red-700 bg-red-100 border-red-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Brain className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-pulse" />
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Generating Enhanced Analysis
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Using AI and CFA frameworks to analyze {symbol}...
            </div>
            <div className="mt-4 w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Analysis Failed
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Unable to generate enhanced analysis for {symbol}. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  const analysisData: EnhancedAnalysisData = analysis

  return (
    <div className="space-y-6">
      {/* Header with Knowledge Enhancement Badge */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Enhanced AI Analysis: {analysisData.symbol}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Professional-grade analysis using CFA methodologies
              </p>
            </div>
          </div>
          {analysisData.enhancedAnalysis && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                <BookOpen className="h-4 w-4 mr-1" />
                Knowledge Enhanced
              </div>
              <button
                onClick={() => setShowKnowledgeSources(!showKnowledgeSources)}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center"
              >
                {analysisData.knowledgeUsed} sources used
                {showKnowledgeSources ? (
                  <ChevronUp className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Knowledge Sources */}
        {showKnowledgeSources && analysisData.documentSources && (
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              📚 Knowledge Sources
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysisData.documentSources.map((source, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                      {source.title}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {Math.round(source.relevance * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {source.source}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                    {source.excerpt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Executive Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <button
          onClick={() => toggleSection('summary')}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Executive Summary</span>
          </div>
          {expandedSections.includes('summary') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {expandedSections.includes('summary') && (
          <div className="p-6">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {analysisData.executiveSummary}
            </p>
          </div>
        )}
      </div>

      {/* Investment Recommendation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <button
          onClick={() => toggleSection('recommendation')}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Investment Recommendation</span>
          </div>
          {expandedSections.includes('recommendation') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {expandedSections.includes('recommendation') && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`inline-flex px-4 py-2 rounded-full text-sm font-semibold border-2 ${getRecommendationColor(analysisData.recommendation.action)}`}>
                  {analysisData.recommendation.action.replace('_', ' ')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Target Price</div>
                <div className="text-lg font-bold text-green-600">
                  ${analysisData.recommendation.targetPrice.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Stop Loss</div>
                <div className="text-lg font-bold text-red-600">
                  ${analysisData.recommendation.stopLoss.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
                <div className="text-lg font-bold text-blue-600">
                  {analysisData.recommendation.confidence}%
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Investment Rationale
              </h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                {analysisData.recommendation.rationale}
              </p>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Time Horizon:</span> {analysisData.recommendation.timeHorizon.replace('_', ' ')}
            </div>
          </div>
        )}
      </div>

      {/* CFA Frameworks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <button
          onClick={() => toggleSection('frameworks')}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-gray-900 dark:text-white">
              CFA Frameworks Applied ({analysisData.cfaFrameworks.length})
            </span>
          </div>
          {expandedSections.includes('frameworks') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {expandedSections.includes('frameworks') && (
          <div className="p-6 space-y-4">
            {analysisData.cfaFrameworks.map((framework, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {framework.name}
                  </h4>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {framework.category}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {framework.description}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Application:</span> {framework.application}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <button
          onClick={() => toggleSection('insights')}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Key Insights</span>
          </div>
          {expandedSections.includes('insights') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {expandedSections.includes('insights') && (
          <div className="p-6">
            <ul className="space-y-3">
              {analysisData.keyInsights.map((insight, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Risk Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <button
          onClick={() => toggleSection('risks')}
          className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Risk Analysis</span>
            <span className={`text-xs px-2 py-1 rounded ${getRiskLevelColor(analysisData.risks.riskLevel)}`}>
              {analysisData.risks.riskLevel} Risk
            </span>
          </div>
          {expandedSections.includes('risks') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>
        {expandedSections.includes('risks') && (
          <div className="p-6 space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Key Risk Factors</h4>
              <ul className="space-y-2">
                {analysisData.risks.keyRiskFactors.map((risk, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {analysisData.risks.mitigation.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Risk Mitigation</h4>
                <ul className="space-y-2">
                  {analysisData.risks.mitigation.map((mitigation, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">{mitigation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Valuation Details */}
      {analysisData.valuation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <button
            onClick={() => toggleSection('valuation')}
            className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Valuation Analysis</span>
            </div>
            {expandedSections.includes('valuation') ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
          {expandedSections.includes('valuation') && (
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Method</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {analysisData.valuation.method}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Fair Value</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${analysisData.valuation.fairValue.toFixed(2)}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Upside</div>
                  <div className={`font-semibold ${analysisData.valuation.upside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {analysisData.valuation.upside >= 0 ? '+' : ''}{analysisData.valuation.upside.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Price/Value</div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {analysisData.valuation.priceToValue.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 