import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  assetClass: string
  price?: number
  change24h?: number
  currency?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    if (query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Mock search results - in a real app, this would search the database
    const allInstruments: SearchResult[] = [
      // NASDAQ Instruments
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 189.45, change24h: 2.34, currency: 'USD' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', assetClass: 'Stock', price: 378.92, change24h: 1.87, currency: 'USD' },
      { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', exchange: 'NASDAQ', assetClass: 'Stock', price: 141.23, change24h: 0.98, currency: 'USD' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 151.84, change24h: 1.56, currency: 'USD' },
      { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 242.68, change24h: -3.45, currency: 'USD' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', assetClass: 'Stock', price: 478.23, change24h: -1.23, currency: 'USD' },
      { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 329.56, change24h: 0.76, currency: 'USD' },
      { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 445.67, change24h: 3.21, currency: 'USD' },
      { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 567.89, change24h: 1.45, currency: 'USD' },
      { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 234.56, change24h: -0.87, currency: 'USD' },
      { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ', assetClass: 'Stock', price: 43.21, change24h: -2.14, currency: 'USD' },
      { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 123.45, change24h: 4.56, currency: 'USD' },
      { symbol: 'CSCO', name: 'Cisco Systems Inc.', exchange: 'NASDAQ', assetClass: 'Stock', price: 51.78, change24h: 0.34, currency: 'USD' },
      { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NASDAQ', assetClass: 'Stock', price: 89.12, change24h: 1.23, currency: 'USD' },
      { symbol: 'QCOM', name: 'QUALCOMM Incorporated', exchange: 'NASDAQ', assetClass: 'Stock', price: 145.67, change24h: 2.89, currency: 'USD' },

      // NSE Instruments
      { symbol: 'RELIANCE', name: 'Reliance Industries Limited', exchange: 'NSE', assetClass: 'Stock', price: 2487.65, change24h: 1.89, currency: 'INR' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Limited', exchange: 'NSE', assetClass: 'Stock', price: 3654.23, change24h: 0.87, currency: 'INR' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE', assetClass: 'Stock', price: 1567.89, change24h: 1.45, currency: 'INR' },
      { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', assetClass: 'Stock', price: 1432.78, change24h: 1.23, currency: 'INR' },
      { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Limited', exchange: 'NSE', assetClass: 'Stock', price: 2345.67, change24h: -0.56, currency: 'INR' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE', assetClass: 'Stock', price: 987.54, change24h: 2.34, currency: 'INR' },
      { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', assetClass: 'Stock', price: 567.89, change24h: 1.67, currency: 'INR' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', exchange: 'NSE', assetClass: 'Stock', price: 876.54, change24h: 3.21, currency: 'INR' },
      { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', assetClass: 'Stock', price: 432.10, change24h: -1.23, currency: 'INR' },
      { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited', exchange: 'NSE', assetClass: 'Stock', price: 1876.54, change24h: 0.89, currency: 'INR' },
      { symbol: 'LT', name: 'Larsen & Toubro Limited', exchange: 'NSE', assetClass: 'Stock', price: 2456.78, change24h: 2.15, currency: 'INR' },
      { symbol: 'HCLTECH', name: 'HCL Technologies Limited', exchange: 'NSE', assetClass: 'Stock', price: 1234.56, change24h: 1.78, currency: 'INR' },
      { symbol: 'AXISBANK', name: 'Axis Bank Limited', exchange: 'NSE', assetClass: 'Stock', price: 987.65, change24h: -0.45, currency: 'INR' },
      { symbol: 'WIPRO', name: 'Wipro Limited', exchange: 'NSE', assetClass: 'Stock', price: 456.78, change24h: 0.98, currency: 'INR' },
      { symbol: 'MARUTI', name: 'Maruti Suzuki India Limited', exchange: 'NSE', assetClass: 'Stock', price: 9876.54, change24h: 3.45, currency: 'INR' },

      // Additional popular stocks
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', assetClass: 'Stock', price: 145.67, change24h: 1.23, currency: 'USD' },
      { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', assetClass: 'Stock', price: 167.89, change24h: 0.45, currency: 'USD' },
      { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', exchange: 'NYSE', assetClass: 'Stock', price: 523.45, change24h: 2.87, currency: 'USD' },
      { symbol: 'PG', name: 'The Procter & Gamble Company', exchange: 'NYSE', assetClass: 'Stock', price: 156.78, change24h: 0.89, currency: 'USD' },
      { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', assetClass: 'Stock', price: 234.56, change24h: 1.56, currency: 'USD' },
    ]

    // Search logic: match symbol or company name
    const searchTerm = query.toLowerCase()
    const matchingResults = allInstruments.filter(instrument => 
      instrument.symbol.toLowerCase().includes(searchTerm) ||
      instrument.name.toLowerCase().includes(searchTerm)
    )

    // Sort by relevance (exact symbol matches first, then symbol starts with, then name matches)
    const sortedResults = matchingResults.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase()
      const bSymbol = b.symbol.toLowerCase()
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      
      // Exact symbol match
      if (aSymbol === searchTerm && bSymbol !== searchTerm) return -1
      if (bSymbol === searchTerm && aSymbol !== searchTerm) return 1
      
      // Symbol starts with search term
      if (aSymbol.startsWith(searchTerm) && !bSymbol.startsWith(searchTerm)) return -1
      if (bSymbol.startsWith(searchTerm) && !aSymbol.startsWith(searchTerm)) return 1
      
      // Symbol contains search term
      if (aSymbol.includes(searchTerm) && !bSymbol.includes(searchTerm)) return -1
      if (bSymbol.includes(searchTerm) && !aSymbol.includes(searchTerm)) return 1
      
      // Name relevance
      return aName.indexOf(searchTerm) - bName.indexOf(searchTerm)
    })

    // Apply limit
    const results = sortedResults.slice(0, limit)

    return NextResponse.json({ 
      results,
      total: matchingResults.length,
      query: query 
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 }
    )
  }
} 