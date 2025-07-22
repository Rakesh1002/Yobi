'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, 
  Brain, 
  FileText, 
  TrendingUp, 
  Settings, 
  Search,
  BookOpen,
  Building2,
  DollarSign,
  Globe
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: BarChart3,
    description: 'Market overview and rankings'
  },
  {
    name: 'Knowledge Base',
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
    badge: 'Enhanced'
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: DollarSign,
    description: 'Portfolio management',
    disabled: true
  },
  {
    name: 'Market Intelligence',
    href: '/market-intelligence',
    icon: Globe,
    description: 'Real-time market data, news sentiment, and technical analysis',
    badge: 'New'
  }
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Yobi Trading
                </span>
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:ml-8 md:flex md:space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                
                return (
                  <Link
                    key={item.name}
                    href={item.disabled ? '#' : item.href}
                    className={`
                      group relative inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : item.disabled
                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                    
                    {item.badge && !item.disabled && (
                      <span className={`
                        ml-2 px-2 py-0.5 text-xs rounded-full font-medium
                        ${item.badge === 'New' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                        }
                      `}>
                        {item.badge}
                      </span>
                    )}

                    {item.disabled && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        Coming Soon
                      </span>
                    )}

                    {/* Tooltip */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                      {item.description}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right side - Search, Notifications, and Settings */}
          <div className="flex items-center space-x-4">
            {/* Global Search */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search symbols, companies..."
                className="block w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            {/* Notifications */}
            <NotificationCenter />

            {/* Settings */}
            <button className="p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 dark:bg-gray-700">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <Link
                key={item.name}
                href={item.disabled ? '#' : item.href}
                className={`
                  group flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : item.disabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-3" />
                <span className="flex-1">{item.name}</span>
                
                {item.badge && !item.disabled && (
                  <span className={`
                    px-2 py-0.5 text-xs rounded-full font-medium
                    ${item.badge === 'New' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                    }
                  `}>
                    {item.badge}
                  </span>
                )}

                {item.disabled && (
                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    Soon
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Mobile Search */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-600">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search symbols, companies..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>
    </nav>
  )
} 