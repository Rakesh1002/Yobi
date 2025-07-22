'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Bot, 
  Search, 
  FileText, 
  Brain, 
  Calendar,
  Play,
  Pause,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Database,
  Globe
} from 'lucide-react'

interface AgentStatus {
  isRunning: boolean
  tasksInQueue: number
  tasksProcessing: number
  tasksCompleted: number
  tasksFailed: number
  lastProcessedAt?: string
  healthStatus: {
    webSearch: boolean
    documentFetcher: boolean
    insightsEngine: boolean
    redis: boolean
  }
}

interface TaskResult {
  symbol: string
  searchResults?: number
  documents?: number
  insights?: number
  confidence?: number
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  publishedDate?: string
  relevanceScore?: number
}

interface InsightData {
  id: string
  symbol: string
  timestamp: string
  insights: Array<{
    type: string
    title: string
    description: string
    impact: string
    timeframe: string
    confidence: number
    actionable: boolean
  }>
  confidence: number
  summary: string
}

export default function BackgroundAgentPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchType, setSearchType] = useState('comprehensive')
  const [isAgentRunning, setIsAgentRunning] = useState(false)
  const queryClient = useQueryClient()

  // Fetch agent status
  const { data: agentStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['agent-status'],
    queryFn: async () => {
      const response = await fetch('/api/agent/status')
      if (!response.ok) throw new Error('Failed to fetch agent status')
      return (await response.json()) as AgentStatus
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Start/Stop agent mutations
  const startAgentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/agent/start', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to start agent')
      return response.json()
    },
    onSuccess: () => {
      setIsAgentRunning(true)
      queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    }
  })

  const stopAgentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/agent/stop', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to stop agent')
      return response.json()
    },
    onSuccess: () => {
      setIsAgentRunning(false)
      queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    }
  })

  // Manual trigger mutations
  const searchCompanyMutation = useMutation({
    mutationFn: async ({ symbol, searchType }: { symbol: string; searchType: string }) => {
      const response = await fetch(`/api/agent/search/company/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchType })
      })
      if (!response.ok) throw new Error('Failed to search company')
      return (await response.json()) as SearchResult[]
    }
  })

  const fetchDocumentsMutation = useMutation({
    mutationFn: async ({ symbol, documentTypes }: { symbol: string; documentTypes?: string[] }) => {
      const response = await fetch(`/api/agent/fetch/documents/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTypes })
      })
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    }
  })

  const generateInsightsMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await fetch(`/api/agent/insights/generate/${symbol}`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to generate insights')
      return (await response.json()) as InsightData
    }
  })

  useEffect(() => {
    if (agentStatus) {
      setIsAgentRunning(agentStatus.isRunning)
    }
  }, [agentStatus])

  const handleStartStop = () => {
    if (isAgentRunning) {
      stopAgentMutation.mutate()
    } else {
      startAgentMutation.mutate()
    }
  }

  const getHealthStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Background AI Agent
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Automated web search, document collection, and insights generation
              </p>
            </div>
          </div>

          {/* Agent Controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleStartStop}
              disabled={startAgentMutation.isPending || stopAgentMutation.isPending}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isAgentRunning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              } disabled:opacity-50`}
            >
              {isAgentRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isAgentRunning ? 'Stop Agent' : 'Start Agent'}</span>
            </button>

            {agentStatus && (
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                agentStatus.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  agentStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium">
                  {agentStatus.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Dashboard */}
        {agentStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tasks in Queue</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{agentStatus.tasksInQueue}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Processing</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{agentStatus.tasksProcessing}</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{agentStatus.tasksCompleted}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{agentStatus.tasksFailed}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>
        )}

        {/* Health Status */}
        {agentStatus && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Service Health
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                {getHealthStatusIcon(agentStatus.healthStatus.webSearch)}
                <span className="text-sm text-gray-600 dark:text-gray-400">Web Search</span>
              </div>
              <div className="flex items-center space-x-2">
                {getHealthStatusIcon(agentStatus.healthStatus.documentFetcher)}
                <span className="text-sm text-gray-600 dark:text-gray-400">Document Fetcher</span>
              </div>
              <div className="flex items-center space-x-2">
                {getHealthStatusIcon(agentStatus.healthStatus.insightsEngine)}
                <span className="text-sm text-gray-600 dark:text-gray-400">Insights Engine</span>
              </div>
              <div className="flex items-center space-x-2">
                {getHealthStatusIcon(agentStatus.healthStatus.redis)}
                <span className="text-sm text-gray-600 dark:text-gray-400">Redis</span>
              </div>
            </div>
          </div>
        )}

        {/* Manual Triggers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Manual Actions</h3>
          
          <div className="space-y-6">
            {/* Symbol Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Symbol
              </label>
              <input
                type="text"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., AAPL, TSLA"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Web Search */}
              <button
                onClick={() => searchCompanyMutation.mutate({ symbol: selectedSymbol, searchType })}
                disabled={searchCompanyMutation.isPending || !selectedSymbol}
                className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Search className="h-6 w-6 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Web Search</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Search for company information</p>
                </div>
              </button>

              {/* Document Fetch */}
              <button
                onClick={() => fetchDocumentsMutation.mutate({ symbol: selectedSymbol })}
                disabled={fetchDocumentsMutation.isPending || !selectedSymbol}
                className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <FileText className="h-6 w-6 text-green-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Fetch Documents</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get SEC filings and reports</p>
                </div>
              </button>

              {/* Generate Insights */}
              <button
                onClick={() => generateInsightsMutation.mutate(selectedSymbol)}
                disabled={generateInsightsMutation.isPending || !selectedSymbol}
                className="flex items-center space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Brain className="h-6 w-6 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Generate Insights</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered analysis</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Results Display */}
        <div className="space-y-6">
          {/* Search Results */}
          {searchCompanyMutation.data && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Globe className="h-5 w-5 mr-2 text-blue-500" />
                Search Results ({searchCompanyMutation.data.length})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {searchCompanyMutation.data.map((result, index) => (
                  <div key={index} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                          {result.title}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {result.snippet}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Source: {result.source}</span>
                          {result.relevanceScore && (
                            <span>Relevance: {(result.relevanceScore * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Fetch Results */}
          {fetchDocumentsMutation.data && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-green-500" />
                Document Fetch Results
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Database className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {fetchDocumentsMutation.data.documentsDiscovered || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Documents Found</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {fetchDocumentsMutation.data.documentsProcessed || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Processed</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round((fetchDocumentsMutation.data.documentsProcessed || 0) / Math.max(1, fetchDocumentsMutation.data.documentsDiscovered || 1) * 100)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                </div>
              </div>
            </div>
          )}

          {/* Insights Results */}
          {generateInsightsMutation.data && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Brain className="h-5 w-5 mr-2 text-purple-500" />
                AI Insights for {generateInsightsMutation.data.symbol}
              </h4>
              
              {/* Summary */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Executive Summary</h5>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  {generateInsightsMutation.data.summary}
                </p>
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">
                  Confidence: {(generateInsightsMutation.data.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {/* Insights List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {generateInsightsMutation.data.insights.slice(0, 5).map((insight, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h6 className="font-medium text-gray-900 dark:text-white">
                        {insight.title}
                      </h6>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          insight.impact === 'HIGH' ? 'bg-red-100 text-red-800' :
                          insight.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {insight.impact}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          {insight.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Timeframe: {insight.timeframe.replace('_', ' ')}</span>
                      <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 