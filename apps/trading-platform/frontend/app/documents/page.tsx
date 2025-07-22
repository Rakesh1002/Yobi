'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  FileText, 
  Building2, 
  Calendar, 
  Download, 
  ExternalLink,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  BarChart3,
  Globe
} from 'lucide-react'

interface CompanyDocument {
  id: string
  symbol: string
  companyName: string
  documentType: string
  title: string
  url: string
  filingDate?: string
  period?: string
  source: string
  status: 'DISCOVERED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  extractedData?: {
    revenue?: number[]
    netIncome?: number[]
    keyMetrics?: any
    riskFactors?: string[]
  }
  metadata: {
    fileSize: number
    pageCount?: number
    confidence: number
  }
  processedAt?: string
}

interface DocumentStats {
  totalDocuments: number
  secFilings: number
  companyReports: number
  processingQueue: number
  lastUpdated: string
}

export default function DocumentIntelligencePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [selectedDocType, setSelectedDocType] = useState('ALL')
  const [selectedSource, setSelectedSource] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<CompanyDocument | null>(null)
  const queryClient = useQueryClient()

  // Fetch document statistics
  const { data: stats } = useQuery({
    queryKey: ['document-stats'],
    queryFn: async () => {
      const response = await fetch('/api/documents/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    refetchInterval: 30000,
  })

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', selectedSymbol, selectedDocType, selectedSource, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedSymbol) params.append('symbol', selectedSymbol)
      if (selectedDocType !== 'ALL') params.append('type', selectedDocType)
      if (selectedSource !== 'ALL') params.append('source', selectedSource)
      if (searchQuery) params.append('search', searchQuery)
      
      const response = await fetch(`/api/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    },
  })

  // Document discovery mutation
  const discoverMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await fetch('/api/documents/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          sources: ['SEC', 'COMPANY_IR'],
          documentTypes: ['10-K', '10-Q', '8-K', 'EARNINGS']
        })
      })
      if (!response.ok) throw new Error('Failed to discover documents')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-stats'] })
    },
  })

  // Document processing mutation
  const processMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to process document')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'PROCESSING': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'DISCOVERED': return <Eye className="h-4 w-4 text-blue-500" />
      default: return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'PROCESSING': return 'text-yellow-600 bg-yellow-100'
      case 'FAILED': return 'text-red-600 bg-red-100'
      case 'DISCOVERED': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case '10-K': return '📋'
      case '10-Q': return '📊'
      case '8-K': return '📢'
      case 'EARNINGS': return '💰'
      case 'PRESENTATION': return '📽️'
      default: return '📄'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Document Intelligence
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                SEC filings, company reports, and automated document discovery
              </p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter symbol (e.g., AAPL)"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => selectedSymbol && discoverMutation.mutate(selectedSymbol)}
                disabled={!selectedSymbol || discoverMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {discoverMutation.isPending ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Discover Documents
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Documents</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.totalDocuments || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SEC Filings</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.secFilings || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Reports</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.companyReports || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Processing Queue</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.processingQueue || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <Filter className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select 
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Document Types</option>
              <option value="10-K">📋 Annual Reports (10-K)</option>
              <option value="10-Q">📊 Quarterly Reports (10-Q)</option>
              <option value="8-K">📢 Current Reports (8-K)</option>
              <option value="EARNINGS">💰 Earnings Releases</option>
              <option value="PRESENTATION">📽️ Presentations</option>
            </select>

            <select 
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Sources</option>
              <option value="SEC">🏛️ SEC EDGAR</option>
              <option value="COMPANY_IR">🏢 Company IR</option>
              <option value="EARNINGS_CALL">📞 Earnings Calls</option>
            </select>

            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {stats?.lastUpdated && `Last updated: ${new Date(stats.lastUpdated).toLocaleTimeString()}`}
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              📚 Company Documents
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading documents...</p>
            </div>
          ) : documents?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Filing Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {documents.data.map((doc: CompanyDocument) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3">
                            {getStatusIcon(doc.status)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                              {doc.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {formatFileSize(doc.metadata.fileSize)}
                              {doc.metadata.pageCount && ` • ${doc.metadata.pageCount} pages`}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {doc.symbol}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {doc.companyName}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getDocumentTypeIcon(doc.documentType)}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {doc.documentType}
                            </div>
                            {doc.period && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {doc.period}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {doc.filingDate ? new Date(doc.filingDate).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                        {doc.metadata.confidence && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {Math.round(doc.metadata.confidence * 100)}% confidence
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedDocument(doc)}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </button>
                          
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Open
                            </a>
                          )}
                          
                          {doc.status === 'DISCOVERED' && (
                            <button
                              onClick={() => processMutation.mutate(doc.id)}
                              disabled={processMutation.isPending}
                              className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {processMutation.isPending ? (
                                <Clock className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <BarChart3 className="h-3 w-3 mr-1" />
                              )}
                              Process
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {selectedSymbol 
                  ? `No documents found for ${selectedSymbol}. Try discovering documents first.`
                  : 'Enter a symbol and discover documents to get started.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getDocumentTypeIcon(selectedDocument.documentType)}</span>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedDocument.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-blue-600">{selectedDocument.symbol}</span>
                    <span>{selectedDocument.companyName}</span>
                    <span>{selectedDocument.source}</span>
                    {selectedDocument.filingDate && (
                      <span>{new Date(selectedDocument.filingDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                  <div className={`text-lg font-semibold ${
                    selectedDocument.status === 'COMPLETED' ? 'text-green-600' :
                    selectedDocument.status === 'PROCESSING' ? 'text-yellow-600' : 
                    selectedDocument.status === 'FAILED' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {selectedDocument.status}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">File Size</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatFileSize(selectedDocument.metadata.fileSize)}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {Math.round(selectedDocument.metadata.confidence * 100)}%
                  </div>
                </div>
              </div>

              {selectedDocument.extractedData && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      🔍 Extracted Financial Data
                    </h4>
                    
                    {selectedDocument.extractedData.revenue && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                          Revenue Trends
                        </div>
                        <div className="flex gap-4">
                          {selectedDocument.extractedData.revenue.map((rev, index) => (
                            <div key={index} className="text-sm">
                              <div className="text-blue-700 dark:text-blue-300">
                                Period {index + 1}
                              </div>
                              <div className="font-semibold text-blue-900 dark:text-blue-100">
                                ${(rev / 1e9).toFixed(2)}B
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedDocument.extractedData.riskFactors && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                          Key Risk Factors
                        </div>
                        <ul className="space-y-1">
                          {selectedDocument.extractedData.riskFactors.slice(0, 5).map((risk, index) => (
                            <li key={index} className="text-sm text-red-800 dark:text-red-200 flex items-start">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedDocument.url && (
                  <a
                    href={selectedDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Original Document
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 