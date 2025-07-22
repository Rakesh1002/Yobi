'use client'

import { useState, useEffect } from 'react'
// SVG Icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
)

const CurrencyDollarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.467-.22-2.121-.659-1.172-.879-1.172-2.303 0-3.182C10.464 7.68 11.232 7.5 12 7.5c.896 0 1.732.207 2.4.6" />
  </svg>
)

interface Currency {
  code: string
  name: string
  symbol: string
}

interface ExchangeRates {
  USD: number
  INR: number
  EUR: number
  GBP: number
  JPY: number
  lastUpdated: string
}

interface CurrencySelectorProps {
  selectedCurrency: string
  onCurrencyChange: (currency: string) => void
  className?: string
}

export default function CurrencySelector({ 
  selectedCurrency, 
  onCurrencyChange, 
  className = '' 
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch supported currencies and exchange rates
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [currenciesRes, ratesRes] = await Promise.all([
          fetch('/api/currency/supported'),
          fetch('/api/currency/rates')
        ])
        
        const currenciesData = await currenciesRes.json()
        const ratesData = await ratesRes.json()
        
        if (currenciesData.success) {
          setCurrencies(currenciesData.data)
        }
        
        if (ratesData.success) {
          setExchangeRates(ratesData.data)
        }
      } catch (error) {
        console.error('Failed to fetch currency data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh exchange rates every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const selectedCurrencyInfo = currencies.find(c => c.code === selectedCurrency)
  const currentRate = exchangeRates?.[selectedCurrency as keyof ExchangeRates]

  const handleCurrencySelect = (currency: string) => {
    onCurrencyChange(currency)
    setIsOpen(false)
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md ${className}`}>
        <CurrencyDollarIcon className="h-4 w-4 mr-2 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        id="currency-menu-button"
        aria-expanded="true"
        aria-haspopup="true"
      >
        <div className="flex items-center">
          <CurrencyDollarIcon className="h-4 w-4 mr-2 text-gray-500" />
          <span className="font-semibold">{selectedCurrencyInfo?.symbol || '$'}</span>
          <span className="ml-2 text-xs text-gray-500">
            {selectedCurrency}
          </span>
          {currentRate && selectedCurrency !== 'USD' && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
              = ${currentRate}
            </span>
          )}
        </div>
        <ChevronDownIcon 
          className={`h-4 w-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 z-20 mt-2 w-72 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Select Currency
              </div>
              
              {currencies.map((currency) => {
                const rate = exchangeRates?.[currency.code as keyof ExchangeRates]
                const isSelected = currency.code === selectedCurrency
                
                return (
                  <button
                    key={currency.code}
                    onClick={() => handleCurrencySelect(currency.code)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                      isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="font-medium text-lg mr-3">
                        {currency.symbol}
                      </span>
                      <div>
                        <div className="font-medium">{currency.code}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {currency.name}
                        </div>
                      </div>
                    </div>
                    
                                         {rate && currency.code !== 'USD' && (
                       <div className="text-right">
                         <div className="text-sm font-medium">
                           ${Number(rate).toFixed(4)}
                         </div>
                         <div className="text-xs text-gray-500 dark:text-gray-400">
                           per USD
                         </div>
                       </div>
                     )}
                    
                    {currency.code === 'USD' && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          Base
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
              
              {exchangeRates && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                    Last updated: {isClient ? new Date(exchangeRates.lastUpdated).toLocaleTimeString() : '--:--:--'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
} 