import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Trading Platform - Smart Investment Analysis',
  description: 'Professional stock trading and investment analysis platform with AI-powered recommendations',
  keywords: 'trading, stocks, investment, analysis, portfolio, financial',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200`}>
        <Providers>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Navigation />
            <main className="bg-gray-50 dark:bg-gray-900 min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
} 