'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { 
  BarChart3, 
  Brain, 
  FileText, 
  TrendingUp, 
  Settings, 
  Search,
  DollarSign,
  Globe,
  Menu,
  X,
  Sun,
  Moon,
  Zap,
  Home,
  Bell,
  Command,
  ChevronRight,
  Activity,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  TrendingDown,
  ArrowUpRight,
  Sparkles
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import NotificationCenter from './NotificationCenter'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: BarChart3,
    description: 'Market overview and rankings',
    shortcut: '⌘1'
  },
  {
    name: 'Knowledge',
    href: '/knowledge',
    icon: Brain,
    description: 'AI-powered financial knowledge',
    shortcut: '⌘2'
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: FileText,
    description: 'SEC filings and company reports',
    shortcut: '⌘3'
  },
  {
    name: 'Analysis',
    href: '/analysis',
    icon: TrendingUp,
    description: 'Enhanced AI investment analysis',
    shortcut: '⌘4',
    badge: 'AI'
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: DollarSign,
    description: 'Portfolio management',
    disabled: true,
    shortcut: '⌘5'
  },
  {
    name: 'Intelligence',
    href: '/market-intelligence',
    icon: Globe,
    description: 'Real-time market intelligence',
    badge: 'Live',
    shortcut: '⌘6'
  }
]

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  assetClass: string
  price?: number
  change24h?: number
  volume?: number
  marketCap?: number
  sector?: string
}

interface CacheStatus {
  healthy: boolean
  lastRefresh: string
  totalKeys: number
  nextRefresh: string
}

interface SystemStatus {
  api: 'online' | 'offline' | 'degraded'
  cache: 'healthy' | 'degraded' | 'failed'
  realtime: 'connected' | 'disconnected' | 'reconnecting'
}

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  
  // Search functionality state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // System status state
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    api: 'online',
    cache: 'healthy',
    realtime: 'connected'
  })
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Load cache status
    fetchCacheStatus()
    
    // Set up periodic status checks
    const statusInterval = setInterval(() => {
      checkSystemStatus()
      fetchCacheStatus()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(statusInterval)
  }, [])

  // Fetch cache status
  const fetchCacheStatus = async () => {
    try {
      const response = await fetch('/api/rankings/cache/stats')
      if (response.ok) {
        const data = await response.json()
        setCacheStatus({
          healthy: data.data?.cacheHealth === 'healthy',
          lastRefresh: data.data?.lastRefresh || new Date().toISOString(),
          totalKeys: data.data?.totalKeys || 0,
          nextRefresh: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        })
        setSystemStatus(prev => ({ ...prev, cache: data.data?.cacheHealth || 'healthy' }))
      }
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, cache: 'failed' }))
    }
  }

  // Check system status
  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        setSystemStatus(prev => ({ ...prev, api: 'online' }))
      } else {
        setSystemStatus(prev => ({ ...prev, api: 'degraded' }))
      }
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, api: 'offline' }))
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault()
            router.push('/')
            break
          case '2':
            e.preventDefault()
            router.push('/knowledge')
            break
          case '3':
            e.preventDefault()
            router.push('/documents')
            break
          case '4':
            e.preventDefault()
            router.push('/analysis')
            break
          case '5':
            e.preventDefault()
            // Portfolio disabled
            break
          case '6':
            e.preventDefault()
            router.push('/market-intelligence')
            break
          case 'k':
            e.preventDefault()
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            searchInput?.focus()
            break
          case '/':
            e.preventDefault()
            setShowQuickActions(true)
            break
        }
      }
      
      if (e.key === 'Escape') {
        setShowSearchResults(false)
        setShowSettings(false)
        setShowQuickActions(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  // Enhanced search with debouncing
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([])
        setShowSearchResults(false)
        return
      }

      setIsSearching(true)
      setShowSearchResults(true)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8&detailed=true`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    []
  )

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    debouncedSearch(query)
  }

  // Navigate to instrument details
  const handleSelectResult = (result: SearchResult) => {
    setSearchQuery('')
    setShowSearchResults(false)
    router.push(`/instrument/${result.symbol}`)
  }

  // Manual cache refresh
  const refreshCache = async () => {
    try {
      const response = await fetch('/api/rankings/cache/refresh', { method: 'POST' })
      if (response.ok) {
        fetchCacheStatus()
      }
    } catch (error) {
      console.error('Cache refresh failed:', error)
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentPage = navigation.find(item => item.href === pathname)

  // Generate breadcrumbs
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs = [{ name: 'Home', href: '/' }]
    
    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/')
      const page = navigation.find(nav => nav.href === href)
      breadcrumbs.push({
        name: page?.name || segment.charAt(0).toUpperCase() + segment.slice(1),
        href
      })
    })
    
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <>
      {/* Desktop Navigation - Top */}
      <nav className="hidden md:block sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-b border-gray-200/30 dark:border-gray-700/30 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-12 gap-4 items-center h-16">
            {/* Logo Section - Enhanced (2 cols) */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -inset-2 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl"></div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Yobi
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    AI Trading
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation Elements - Enhanced (8 cols) */}
            <div className="col-span-8 flex justify-center">
              <div className="flex items-center space-x-1 bg-gray-50/60 dark:bg-gray-800/40 rounded-3xl p-1.5 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 shadow-inner">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.name}
                      href={item.disabled ? '#' : item.href}
                      className={`
                        group relative flex items-center px-4 lg:px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-500 whitespace-nowrap
                        ${isActive
                          ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-lg shadow-blue-500/10 transform scale-105'
                          : item.disabled
                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-gray-700/80 hover:scale-105'
                        }
                      `}
                      title={`${item.description} ${item.shortcut ? `(${item.shortcut})` : ''}`}
                    >
                      <Icon className={`h-4 w-4 transition-all duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400 scale-110' : ''}`} />
                      
                      {isActive && (
                        <>
                          <span className={`ml-3 hidden xl:block relative text-blue-700 dark:text-blue-300`}>
                            {item.name}
                            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                          </span>
                          {/* Enhanced badges */}
                          {item.badge && !item.disabled && (
                            <span className={`
                              ml-2 px-2.5 py-1 text-xs rounded-full font-semibold transition-all duration-300 hidden xl:block relative overflow-hidden
                              ${item.badge === 'New' 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30' 
                                : item.badge === 'AI'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                                : item.badge === 'Live'
                                ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                              }
                            `}>
                              {item.badge}
                              {item.badge === 'Live' && (
                                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-orange-500 opacity-0 hover:opacity-30 transition-opacity duration-300"></div>
                              )}
                            </span>
                          )}

                          {/* Keyboard shortcut hint */}
                          {item.shortcut && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden xl:block">
                              {item.shortcut}
                            </span>
                          )}

                          {item.disabled && (
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hidden xl:block">
                              Soon
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right Section - Enhanced (2 cols) */}
            <div className="col-span-2 flex items-center justify-end space-x-3">

              {/* Enhanced Search */}
              <div ref={searchRef} className="relative hidden lg:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Command className="absolute right-8 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                    K
                  </kbd>
                  <input
                    type="text"
                    placeholder="Search symbols, companies..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                    className="block w-48 xl:w-64 pl-10 pr-16 py-2.5 border border-gray-200/60 dark:border-gray-600/60 rounded-2xl leading-5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                </div>
                
                {/* Enhanced Search Results Dropdown */}
                {showSearchResults && (
                  <div className="absolute top-full mt-3 w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 max-h-80 overflow-y-auto z-50">
                    {isSearching ? (
                      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <span className="text-sm">Searching markets...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 font-medium">
                          Found {searchResults.length} results
                        </div>
                        {searchResults.map((result, index) => (
                          <button
                            key={result.symbol}
                            onClick={() => handleSelectResult(result)}
                            className="w-full px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 group"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {result.symbol}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {result.exchange}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
                                  {result.name}
                                </div>
                                {result.sector && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    {result.sector}
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                {result.price && (
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    ${result.price.toFixed(2)}
                                  </div>
                                )}
                                {result.change24h !== undefined && (
                                  <div className={`text-xs font-medium flex items-center ${
                                    result.change24h >= 0 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {result.change24h >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                    {result.change24h.toFixed(2)}%
                                  </div>
                                )}
                                {result.volume && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500">
                                    Vol: {(result.volume / 1000000).toFixed(1)}M
                                  </div>
                                )}
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">No results found for "{searchQuery}"</div>
                        <div className="text-xs mt-1">Try searching by symbol, company name, or sector</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/50 relative"
                title="Quick Actions (⌘/)"
              >
                <Sparkles className="h-5 w-5" />
                {showQuickActions && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                )}
              </button>

              {/* Notifications */}
              <NotificationCenter />

              {/* Enhanced Settings */}
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                >
                  <Settings className="h-5 w-5" />
                </button>

                {/* Enhanced Settings Dropdown */}
                {showSettings && (
                  <div className="absolute right-0 top-full mt-3 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-50">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                          v2.1.0
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Theme Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {theme === 'dark' ? <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
                          </div>
                          <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                              theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${
                                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Auto-refresh */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-refresh</span>
                          </div>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors duration-300">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition-transform duration-300 shadow-sm" />
                          </button>
                        </div>

                        {/* Real-time data */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {systemStatus.realtime === 'connected' ? 
                              <Wifi className="w-4 h-4 text-green-500" /> : 
                              <WifiOff className="w-4 h-4 text-red-500" />
                            }
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Real-time Data</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            systemStatus.realtime === 'connected' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {systemStatus.realtime}
                          </span>
                        </div>

                        {/* Cache Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cache Status</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              systemStatus.cache === 'healthy' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {systemStatus.cache}
                            </span>
                            <button
                              onClick={refreshCache}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Refresh Cache"
                            >
                              <RefreshCw className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <button className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Keyboard Shortcuts
                          </button>
                          <button className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Preferences
                          </button>
                          <button className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            About Yobi
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <div className="border-t border-gray-200/30 dark:border-gray-700/30 bg-gray-50/30 dark:bg-gray-800/30">
            <div className="px-4 sm:px-6 lg:px-8 py-2">
              <div className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center space-x-2">
                    {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                    <Link
                      href={crumb.href}
                      className={`transition-colors duration-200 ${
                        index === breadcrumbs.length - 1
                          ? 'text-gray-900 dark:text-white font-medium'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {crumb.name}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Quick Actions Modal */}
      {showQuickActions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
                <button
                  onClick={() => setShowQuickActions(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => { router.push('/'); setShowQuickActions(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-3"
                >
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Go to Dashboard</span>
                  <span className="text-xs text-gray-400 ml-auto">⌘1</span>
                </button>
                <button
                  onClick={() => { refreshCache(); setShowQuickActions(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-3"
                >
                  <RefreshCw className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Refresh Cache</span>
                </button>
                <button
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowQuickActions(false) }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-3"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-purple-500" />}
                  <span className="text-sm font-medium">Toggle Theme</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation - Enhanced */}
      <div className="md:hidden">
        {/* Top Mobile Header - Enhanced */}
        <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Yobi
                </span>
              </Link>

              {/* Current Page Info with System Status */}
              <div className="flex items-center space-x-2">
                {currentPage && (
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <currentPage.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{currentPage.name}</span>
                  </div>
                )}
                
                {/* Mobile System Status */}
                <div className={`w-2 h-2 rounded-full ${
                  systemStatus.api === 'online' 
                    ? 'bg-green-500 animate-pulse' 
                    : systemStatus.api === 'degraded'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}></div>
              </div>

              {/* Mobile Controls */}
              <div className="flex items-center space-x-2">
                <NotificationCenter />
                {mounted && (
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg"
                  >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Enhanced Mobile Search */}
            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search symbols, companies..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all duration-300"
                />
              </div>
            </div>
          </div>
        </nav>

        {/* Enhanced Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 shadow-lg">
          <div className="grid grid-cols-3 h-16">
            {/* Dashboard */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center space-y-1 transition-all duration-300 ${
                pathname === '/' 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 scale-105' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs font-medium">Dashboard</span>
            </Link>

            {/* Analysis/AI */}
            <Link
              href="/analysis"
              className={`flex flex-col items-center justify-center space-y-1 transition-all duration-300 relative ${
                pathname === '/analysis' 
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/20 scale-105' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-medium">Analysis</span>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full animate-pulse"></div>
            </Link>

            {/* Intelligence */}
            <Link
              href="/market-intelligence"
              className={`flex flex-col items-center justify-center space-y-1 transition-all duration-300 relative ${
                pathname === '/market-intelligence' 
                  ? 'text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20 scale-105' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Intelligence</span>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-full animate-pulse"></div>
            </Link>
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-16"></div>
      </div>

      {/* Backdrop for modals */}
      {(showSettings || showQuickActions) && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" 
          onClick={() => {
            setShowSettings(false)
            setShowQuickActions(false)
          }}
        />
      )}
    </>
  )
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
} 