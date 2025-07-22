'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { 
  Upload, 
  Search, 
  FileText, 
  Brain, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Book,
  Download,
  X,
  ChevronDown,
  Filter
} from 'lucide-react'

interface KnowledgeDocument {
  id: string
  title: string
  source: string
  category: string
  uploadedAt: string
  size: number
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  chunks: number
  concepts: string[]
}

interface SearchResult {
  id: string
  title: string
  content: string
  score: number
  source: string
  category: string
  concepts: string[]
  metadata: {
    chunkIndex: number
    sectionTitle?: string
  }
}

interface EnhancedAnalysis {
  symbol: string
  analysis: {
    recommendation: {
      action: string
      targetPrice: number
      confidence: number
      rationale: string
    }
    knowledgeUsed: number
    cfaFrameworks: string[]
    keyInsights: string[]
    documentSources: string[]
  }
}

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedSource, setSelectedSource] = useState('ALL')
  const [analysisSymbol, setAnalysisSymbol] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null)
  const queryClient = useQueryClient()

  // Fetch knowledge base statistics
  const { data: stats } = useQuery({
    queryKey: ['knowledge-stats'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    refetchInterval: 30000,
  })

  // Fetch documents
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['knowledge-documents', selectedCategory, selectedSource],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory)
      if (selectedSource !== 'ALL') params.append('source', selectedSource)
      
      const response = await fetch(`/api/knowledge/documents?${params}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json()
    },
  })

  // Search knowledge base
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['knowledge-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { results: [] }
      
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
          threshold: 0.7
        })
      })
      if (!response.ok) throw new Error('Failed to search')
      return response.json()
    },
    enabled: !!searchQuery.trim(),
  })

  // Enhanced analysis mutation
  const enhancedAnalysisMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await fetch('/api/knowledge/analysis/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          analysisType: 'FUNDAMENTAL',
          includeKnowledge: true
        })
      })
      if (!response.ok) throw new Error('Failed to generate analysis')
      return response.json()
    },
  })

  // Document upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
      formData.append('source', 'USER_UPLOAD')
      formData.append('category', 'RESEARCH')

      const response = await fetch('/api/knowledge/documents/upload', {
        method: 'POST',
        body: formData
      })
      if (!response.ok) throw new Error('Failed to upload document')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] })
      setShowUpload(false)
    },
  })

  // Dropzone for file upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      uploadMutation.mutate(file)
    })
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/html': ['.html'],
      'text/plain': ['.txt']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'PROCESSING': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100'
      case 'PROCESSING': return 'text-yellow-600 bg-yellow-100'
      case 'FAILED': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Knowledge Base
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                AI-powered financial knowledge and document intelligence
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Book className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Documents</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.documentCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Knowledge Chunks</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.chunkCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Concepts Extracted</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.conceptCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Analyses Generated</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats?.analysisCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Search & Browse */}
          <div className="space-y-6">
            {/* Search Interface */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🔍 Search Knowledge Base
              </h2>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for financial concepts, methodologies, formulas..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {searchQuery && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {searchLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : searchResults?.results?.length > 0 ? (
                    searchResults.results.map((result: SearchResult) => (
                      <div key={result.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                            {result.title}
                          </h3>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {Math.round(result.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-3">
                          {result.content}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.concepts.slice(0, 3).map((concept) => (
                            <span key={concept} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No results found for "{searchQuery}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Document Browser */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📚 Document Library
                </h2>
                <div className="flex gap-2">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="CFA">CFA Materials</option>
                    <option value="RESEARCH">Research Reports</option>
                    <option value="EDUCATION">Educational</option>
                    <option value="SEC_FILING">SEC Filings</option>
                  </select>
                  <select 
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                  >
                    <option value="ALL">All Sources</option>
                    <option value="CFA_INSTITUTE">CFA Institute</option>
                    <option value="SEC">SEC</option>
                    <option value="USER_UPLOAD">User Upload</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {documentsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : documents?.data?.length > 0 ? (
                  documents.data.map((doc: KnowledgeDocument) => (
                    <div key={doc.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                         onClick={() => setSelectedDocument(doc)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(doc.status)}
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                              {doc.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{doc.source}</span>
                            <span>{doc.category}</span>
                            <span>{doc.chunks} chunks</span>
                            <span>{(doc.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No documents found
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Enhanced Analysis */}
          <div className="space-y-6">
            {/* RAG Analysis Generator */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🧠 AI-Enhanced Analysis
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stock Symbol
                  </label>
                  <input
                    type="text"
                    value={analysisSymbol}
                    onChange={(e) => setAnalysisSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g., AAPL, RELIANCE"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <button
                  onClick={() => enhancedAnalysisMutation.mutate(analysisSymbol)}
                  disabled={!analysisSymbol || enhancedAnalysisMutation.isPending}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {enhancedAnalysisMutation.isPending ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating Analysis...
                    </div>
                  ) : (
                    'Generate Enhanced Analysis'
                  )}
                </button>
              </div>

              {enhancedAnalysisMutation.data && (
                <div className="mt-6 space-y-4">
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                      Analysis Results for {enhancedAnalysisMutation.data.symbol}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Recommendation</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {enhancedAnalysisMutation.data.analysis.recommendation.action}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {enhancedAnalysisMutation.data.analysis.recommendation.confidence}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 mb-4">
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Investment Rationale
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        {enhancedAnalysisMutation.data.analysis.recommendation.rationale}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          CFA Frameworks Applied ({enhancedAnalysisMutation.data.analysis.cfaFrameworks.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {enhancedAnalysisMutation.data.analysis.cfaFrameworks.map((framework: string) => (
                            <span key={framework} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {framework}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Knowledge Sources ({enhancedAnalysisMutation.data.analysis.knowledgeUsed})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {enhancedAnalysisMutation.data.analysis.documentSources.map((source: string) => (
                            <span key={source} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {enhancedAnalysisMutation.error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <div className="text-red-800 dark:text-red-200 text-sm">
                    Error: {enhancedAnalysisMutation.error.message}
                  </div>
                </div>
              )}
            </div>

            {/* Processing Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                ⚡ Recent Activity
              </h2>
              
              <div className="space-y-3">
                {documents?.data?.filter((doc: KnowledgeDocument) => doc.status === 'PROCESSING').length > 0 ? (
                  documents.data
                    .filter((doc: KnowledgeDocument) => doc.status === 'PROCESSING')
                    .slice(0, 3)
                    .map((doc: KnowledgeDocument) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                        <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Processing: {doc.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Extracting concepts and generating embeddings...
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    No active processing
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Upload Document
                </h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag & drop files here, or click to select'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  PDF, DOCX, HTML, TXT (max 100MB)
                </p>
              </div>

              {uploadMutation.isPending && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                      Uploading and processing document...
                    </span>
                  </div>
                </div>
              )}

              {uploadMutation.error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <div className="text-red-800 dark:text-red-200 text-sm">
                    Error: {uploadMutation.error.message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedDocument.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>{selectedDocument.source}</span>
                    <span>{selectedDocument.category}</span>
                    <span>{new Date(selectedDocument.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                  <div className={`font-medium ${
                    selectedDocument.status === 'COMPLETED' ? 'text-green-600' :
                    selectedDocument.status === 'PROCESSING' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {selectedDocument.status}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Knowledge Chunks</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {selectedDocument.chunks}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extracted Concepts
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.concepts.map((concept) => (
                    <span key={concept} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 