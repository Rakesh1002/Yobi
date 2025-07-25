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
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DISCOVERED' | 'PROCESSED'
  chunks: number
  concepts: string[]
  originalFilename?: string
  mimeType?: string
  hasFile?: boolean
  fileStorageType?: 's3' | 'none'
  ragProcessed?: boolean
  embeddingsGenerated?: number
  vectorsStored?: number
  ragStatus?: 'completed' | 'pending' | 'failed'
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

  // Document download mutation
  const downloadMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}/download`)
      if (!response.ok) throw new Error('Failed to get download URL')
      return response.json()
    },
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.data.downloadUrl, '_blank')
    },
  })

  // Document view mutation  
  const viewMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}/view`)
      if (!response.ok) throw new Error('Failed to get view URL')
      return response.json()
    },
    onSuccess: (data) => {
      // Open view URL in new tab
      window.open(data.data.viewUrl, '_blank')
    },
  })

  // Document delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete document')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] })
      setSelectedDocument(null)
    },
  })

  // RAG health check
  const { data: ragHealth } = useQuery({
    queryKey: ['knowledge-health'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge/health')
      if (!response.ok) throw new Error('Failed to fetch RAG health')
      return response.json()
    },
    refetchInterval: 60000, // Check every minute
  })

  // Document RAG status query
  const { data: ragStatus } = useQuery({
    queryKey: ['document-rag-status', selectedDocument?.id],
    queryFn: async () => {
      if (!selectedDocument?.id) return null
      const response = await fetch(`/api/knowledge/documents/${selectedDocument.id}/rag-status`)
      if (!response.ok) throw new Error('Failed to fetch RAG status')
      return response.json()
    },
    enabled: !!selectedDocument?.id,
  })

  // Document reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/knowledge/documents/${documentId}/reprocess`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to reprocess document')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-rag-status'] })
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
      case 'COMPLETED':
      case 'PROCESSED': return 'text-green-600 bg-green-100'
      case 'PROCESSING': return 'text-yellow-600 bg-yellow-100'
      case 'FAILED': return 'text-red-600 bg-red-100'
      case 'DISCOVERED': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getRagStatusIcon = (ragProcessed: boolean | undefined, embeddingsGenerated: number | undefined) => {
    if (ragProcessed && embeddingsGenerated && embeddingsGenerated > 0) {
      return <Brain className="h-4 w-4 text-purple-500" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getRagStatusText = (ragProcessed: boolean | undefined, embeddingsGenerated: number | undefined, vectorsStored: number | undefined) => {
    if (ragProcessed && embeddingsGenerated && embeddingsGenerated > 0) {
      return `RAG: ${embeddingsGenerated} embeddings, ${vectorsStored || 0} vectors`
    }
    return 'RAG: Not processed'
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
                  {stats?.data?.documentCount || 0}
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
                  {stats?.data?.chunkCount || 0}
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
                  {stats?.data?.conceptCount || 0}
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
                  {stats?.data?.analysisCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RAG System Health Dashboard */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            RAG System Status
          </h2>
          
          {ragHealth && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.ragCapable ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {ragHealth.features.ragCapable ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">RAG Ready</p>
                <p className="text-xs text-gray-500">{ragHealth.features.ragCapable ? 'Active' : 'Inactive'}</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.embeddings === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  <Brain className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Embeddings</p>
                <p className="text-xs text-gray-500">{ragHealth.features.embeddings}</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.vectorDatabase === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  <Search className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Vector DB</p>
                <p className="text-xs text-gray-500">{ragHealth.features.vectorDatabase}</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.fileStorage === 's3_available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  <Upload className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">File Storage</p>
                <p className="text-xs text-gray-500">{ragHealth.features.fileStorage}</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.semanticSearch === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Search</p>
                <p className="text-xs text-gray-500">{ragHealth.features.semanticSearch}</p>
              </div>
              
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-2 ${
                  ragHealth.features.enhancedAnalysis === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">AI Analysis</p>
                <p className="text-xs text-gray-500">{ragHealth.features.enhancedAnalysis}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Search & Browse */}
          <div className="space-y-6">
            {/* Search Interface */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                <span>🔍 Search Knowledge Base</span>
                {ragHealth?.features.ragCapable && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    Vector Search
                  </span>
                )}
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
                  {searchResults?.metadata && (
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                      <span>
                        {searchResults.metadata.total} results found
                        {searchResults.metadata.searchType && (
                          <span className={`ml-2 px-2 py-1 rounded ${
                            searchResults.metadata.searchType === 'vector' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {searchResults.metadata.searchType === 'vector' ? 'Vector Search' : 'Fallback Search'}
                          </span>
                        )}
                      </span>
                      {searchResults.metadata.ragEnabled !== undefined && !searchResults.metadata.ragEnabled && (
                        <span className="text-yellow-600">RAG unavailable</span>
                      )}
                    </div>
                  )}
                  
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
                    <div key={doc.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setSelectedDocument(doc)}>
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(doc.status)}
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                              {doc.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>{doc.source}</span>
                            <span>{doc.category}</span>
                            <span>{doc.chunks} chunks</span>
                            <span>{(doc.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {getRagStatusIcon(doc.ragProcessed, doc.embeddingsGenerated)}
                            <span className={doc.ragProcessed ? 'text-purple-600' : 'text-gray-400'}>
                              {getRagStatusText(doc.ragProcessed, doc.embeddingsGenerated, doc.vectorsStored)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                          
                          {/* Action buttons */}
                          {doc.hasFile && doc.fileStorageType === 's3' && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  viewMutation.mutate(doc.id)
                                }}
                                disabled={viewMutation.isPending}
                                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="View document"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadMutation.mutate(doc.id)
                                }}
                                disabled={downloadMutation.isPending}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                title="Download document"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              
                              {ragHealth?.features.ragCapable && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    reprocessMutation.mutate(doc.id)
                                  }}
                                  disabled={reprocessMutation.isPending}
                                  className="p-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                                  title="Reprocess through RAG pipeline"
                                >
                                  <Brain className="h-4 w-4" />
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm('Are you sure you want to delete this document?')) {
                                    deleteMutation.mutate(doc.id)
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Delete document"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
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
                    <div className="font-medium mb-1">Upload Failed:</div>
                    <div>{uploadMutation.error.message}</div>
                    <div className="text-xs mt-2 opacity-75">
                      Please check: file size (&lt; 100MB), file type (PDF, DOCX, DOC, HTML, TXT), and browser console for details.
                    </div>
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

              {/* File actions */}
              {selectedDocument.hasFile && selectedDocument.fileStorageType === 's3' && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    File Actions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewMutation.mutate(selectedDocument.id)}
                      disabled={viewMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {viewMutation.isPending ? 'Opening...' : 'View File'}
                    </button>
                    
                    <button
                      onClick={() => downloadMutation.mutate(selectedDocument.id)}
                      disabled={downloadMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadMutation.isPending ? 'Downloading...' : 'Download'}
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                          deleteMutation.mutate(selectedDocument.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  
                  {selectedDocument.originalFilename && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Original filename: {selectedDocument.originalFilename}
                    </div>
                  )}
                </div>
              )}
              
              {selectedDocument.fileStorageType === 'none' && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                    ⚠️ File storage not configured. Files are not available for download.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 