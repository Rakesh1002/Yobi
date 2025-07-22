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
  Bell
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import NotificationCenter from './NotificationCenter'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: BarChart3,
    description: 'Market overview and rankings'
  },
  {
    name: 'Knowledge',
    href: '/knowledge',
    icon: Brain,
    description: 'AI-powered financial knowledge',
    badge: 'New'
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: FileText,
    description: 'SEC filings and company reports',
    badge: 'New'
  },
  {
    name: 'Analysis',
    href: '/analysis',
    icon: TrendingUp,
    description: 'Enhanced AI investment analysis',
    badge: 'AI'
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: DollarSign,
    description: 'Portfolio management',
    disabled: true
  },
  {
    name: 'Intelligence',
    href: '/market-intelligence',
    icon: Globe,
    description: 'Real-time market intelligence',
    badge: 'Live'
  }
]

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  assetClass: string
  price?: number
  change24h?: number
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
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle search functionality
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    setShowSearchResults(true)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        // Fallback to local search if API is not available
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Navigate to instrument details
  const handleSelectResult = (result: SearchResult) => {
    setSearchQuery('')
    setShowSearchResults(false)
    router.push(`/instrument/${result.symbol}`)
  }

  // Close search results when clicking outside
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

  return (
    <>
      {/* Desktop Navigation - Top */}
      <nav className="hidden md:block sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-12 gap-4 items-center h-16">
            {/* Logo Section - Extreme Left (2 cols) */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur"></div>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Yobi
                </span>
              </Link>
            </div>

            {/* Navigation Elements - Center (8 cols) */}
            <div className="col-span-8 flex justify-center">
              <div className="flex items-center space-x-1 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-1 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.disabled ? '#' : item.href}
                      className={`
                        group relative flex items-center px-3 lg:px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 whitespace-nowrap
                        ${isActive
                          ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-md shadow-blue-500/10'
                          : item.disabled
                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/60'
                        }
                      `}
                      title={item.description}
                    >
                      <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      
                      {/* Show text on larger screens, hide on smaller */}
                      <span className={`ml-2.5 hidden xl:block relative ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                        {item.name}
                        {isActive && (
                          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                        )}
                      </span>
                      
                      {/* Show only on large screens */}
                      {item.badge && !item.disabled && (
                        <span className={`
                          ml-2 px-2 py-0.5 text-xs rounded-full font-semibold transition-all duration-300 hidden xl:block
                          ${item.badge === 'New' 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm' 
                            : item.badge === 'AI'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-sm'
                            : item.badge === 'Live'
                            ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-sm animate-pulse'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                          }
                        `}>
                          {item.badge}
                        </span>
                      )}

                      {item.disabled && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hidden xl:block">
                          Soon
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right Section - Extreme Right (2 cols) */}
            <div className="col-span-2 flex items-center justify-end space-x-2">
              {/* Search */}
              <div ref={searchRef} className="relative hidden lg:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search symbols..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                  className="block w-40 xl:w-56 pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all duration-300 hover:bg-white/90 dark:hover:bg-gray-800/90 focus:bg-white dark:focus:bg-gray-800"
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && (
                  <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto z-50">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                        <span className="ml-2">Searching...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          onClick={() => handleSelectResult(result)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {result.symbol}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {result.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {result.exchange}
                              </div>
                              {result.price && (
                                <div className={`text-sm font-medium ${
                                  result.change24h && result.change24h >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  ${result.price.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No results found for "{searchQuery}"
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
              )}

              {/* Notifications */}
              <NotificationCenter />

              {/* Settings */}
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                >
                  <Settings className="h-5 w-5" />
                </button>

                {/* Settings Dropdown */}
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
                          <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Auto-refresh</span>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                          </button>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <button className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                            Preferences
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
      </nav>

      {/* Mobile Navigation - Bottom */}
      <div className="md:hidden">
        {/* Top Mobile Header */}
        <nav className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Yobi
                </span>
              </Link>

              {/* Current Page Info */}
              <div className="flex items-center space-x-2">
                {currentPage && (
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <currentPage.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{currentPage.name}</span>
                  </div>
                )}
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

            {/* Mobile Search */}
            <div className="mt-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
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

        {/* Bottom Navigation - 3 Button Structure */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 shadow-lg">
          <div className="grid grid-cols-3 h-16">
            {/* Dashboard */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center space-y-1 transition-all duration-300 ${
                pathname === '/' 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' 
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
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/20' 
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
                  ? 'text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Intelligence</span>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-full animate-pulse"></div>
            </Link>
          </div>
        </div>

        {/* Bottom padding to prevent content from being hidden behind bottom nav */}
        <div className="h-16"></div>
      </div>

      {/* Settings backdrop */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSettings(false)}
        />
      )}
    </>
  )
} 