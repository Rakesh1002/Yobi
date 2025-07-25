"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  Target,
  Shield,
  AlertTriangle,
  FileText,
  BookOpen,
  Star,
  Bell,
  Download,
  Plus,
  Clock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  formatCurrency,
  formatPercentage,
  formatVolume,
  getCurrencyFromExchange,
} from "@yobi/financial-utils";
import { useWebSocket } from "@/components/WebSocketProvider";

const Markdown = ReactMarkdown as any;

interface KnowledgeSource {
  title: string;
  source: string;
  relevance?: number;
  excerpt?: string;
  chunkId?: string;
}

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  sentiment: number | null;
  imageUrl: string | null;
}

interface InstrumentDetail {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap?: number;
  sector?: string;
  technicalScore: number;
  fundamentalScore: number;
  momentumScore: number;
  totalScore: number;
  signal: string;
  expectedReturn: number;
  recommendation?: {
    action: string;
    targetPrice: number;
    stopLoss: number;
    timeHorizon: string;
    confidence: number;
    rationale: string;
    keyPoints: string[];
    risks: string[];
    sources?: KnowledgeSource[];
  };
}

interface TechnicalAnalysis {
  rsi: number;
  macd: {
    signal: string;
    value: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  support: number;
  resistance: number;
  trend: string;
}

interface FundamentalData {
  peRatio: number;
  pbRatio: number;
  debtToEquity: number;
  roe: number;
  eps: number;
  revenue: number;
  revenueGrowth: number;
  netMargin: number;
  dividendYield: number;
  beta: number;
}

interface DocumentResult {
  id: string;
  title: string;
  source: string;
  category: string;
  uploadedAt: string;
  size: number;
  hasFile: boolean;
  ragProcessed: boolean;
}

interface KnowledgeResult {
  title: string;
  source: string;
  relevance: number;
  excerpt: string;
  chunkId: string;
}

export default function InstrumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartLoaded, setChartLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "technical" | "fundamentals" | "news" | "reports"
  >("overview");
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [alertSet, setAlertSet] = useState(false);

  // Get WebSocket connection
  const { socket } = useWebSocket();

  // Fetch instrument details
  const {
    data: instrument,
    isLoading: instrumentLoading,
    error,
    refetch: refetchInstrument,
  } = useQuery({
    queryKey: ["instrument", symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(
        `${apiUrl}/api/instruments/${symbol}?refresh=${Date.now()}`
      );
      if (!response.ok) throw new Error("Failed to fetch instrument details");
      return (await response.json()) as InstrumentDetail;
    },
    enabled: !!symbol,
  });

  // Fetch technical analysis
  const { data: technicalData, isLoading: technicalLoading } = useQuery({
    queryKey: ["technical", symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(
        `${apiUrl}/api/instruments/${symbol}/technical`
      );
      if (!response.ok) throw new Error("Failed to fetch technical analysis");
      const result = await response.json();
      return result.data as TechnicalAnalysis;
    },
    enabled: !!symbol && activeTab === "technical",
  });

  // Fetch fundamental data
  const { data: fundamentalData, isLoading: fundamentalLoading } = useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(
        `${apiUrl}/api/instruments/${symbol}/fundamentals`
      );
      if (!response.ok) throw new Error("Failed to fetch fundamental data");
      const result = await response.json();
      return result.data as FundamentalData;
    },
    enabled: !!symbol && activeTab === "fundamentals",
  });

  // Fetch latest news
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["news", symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(`${apiUrl}/api/instruments/${symbol}/news`);
      if (!response.ok) throw new Error("Failed to fetch news");
      const result = await response.json();
      return result.data as NewsArticle[];
    },
    enabled: !!symbol && activeTab === "news",
  });

  // Fetch related documents
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", symbol],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(
        `${apiUrl}/api/knowledge/documents?category=SEC_FILING&source=${symbol}`
      );
      if (!response.ok) throw new Error("Failed to fetch documents");
      const result = await response.json();
      return result.data as DocumentResult[];
    },
    enabled: !!symbol && activeTab === "reports",
  });

  // Load TradingView widget
  useEffect(() => {
    if (!chartRef.current || chartLoaded || !symbol || !instrument) return;

    // Clear any existing content
    chartRef.current.innerHTML = "";

    // Determine the correct symbol format for TradingView
    let tvSymbol = symbol;
    if (instrument.exchange === "NSE") {
      tvSymbol = `BSE:${symbol}`;
    } else if (instrument.exchange === "NASDAQ") {
      tvSymbol = `NASDAQ:${symbol}`;
    } else if (instrument.exchange === "NYSE") {
      tvSymbol = `NYSE:${symbol}`;
    }

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "500px";
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;

    const config = {
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      allow_symbol_change: true,
      withdateranges: true,
      range: "YTD",
      hide_side_toolbar: false,
      save_image: false,
      studies: [
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies",
        "BB@tv-basicstudies",
      ],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
    };

    script.innerHTML = JSON.stringify(config);

    widgetContainer.appendChild(widgetDiv);
    widgetContainer.appendChild(script);

    if (chartRef.current) {
      chartRef.current.appendChild(widgetContainer);
      setChartLoaded(true);

      // Add a timeout to reset if chart doesn't load
      const timeout = setTimeout(() => {
        if (
          chartRef.current &&
          !chartRef.current.querySelector(
            ".tradingview-widget-container iframe"
          )
        ) {
          console.warn("TradingView chart failed to load, resetting...");
          setChartLoaded(false);
        }
      }, 10000); // 10 second timeout

      return () => {
        clearTimeout(timeout);
      };
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.innerHTML = "";
      }
      setChartLoaded(false);
    };
  }, [symbol, instrument?.exchange, instrument, chartLoaded]);

  // Portfolio actions
  const handleAddToPortfolio = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(`${apiUrl}/api/portfolio/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol,
          action: "add_to_watchlist", // This would be expanded to handle actual portfolio management
        }),
      });
      if (response.ok) {
        alert(`${symbol} added to portfolio successfully!`);
      }
    } catch (error) {
      console.error("Failed to add to portfolio:", error);
      alert("Failed to add to portfolio. Please try again.");
    }
  };

  const handleAddToWatchlist = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(`${apiUrl}/api/portfolio/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol,
          name: instrument?.name || symbol,
        }),
      });
      if (response.ok) {
        setWatchlistAdded(true);
        alert(`${symbol} added to watchlist!`);
      }
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      alert("Failed to add to watchlist. Please try again.");
    }
  };

  const handleSetAlert = async () => {
    if (!instrument) return;

    const alertPrice = prompt(
      `Set price alert for ${symbol}:`,
      instrument.price.toString() || ""
    );
    if (!alertPrice || isNaN(Number(alertPrice))) return;

    try {
      // Use WebSocket to create alert for real-time integration
      if (socket && socket.connected) {
        socket.emit("create_alert", {
          userId: "demo-user-001", // In production, get from auth context
          symbol: symbol.toUpperCase(),
          type: "PRICE",
          condition: {
            operator: Number(alertPrice) > instrument.price ? "above" : "below",
            value: Number(alertPrice),
          },
          message: `${symbol} ${
            Number(alertPrice) > instrument.price
              ? "reached target"
              : "dropped below"
          } ${alertPrice}`,
        });

        // Listen for creation confirmation
        socket.once(
          "alert_created",
          (response: { success: boolean; alert: any }) => {
            if (response.success) {
              setAlertSet(true);
              alert(`✅ Price alert set for ${symbol} at $${alertPrice}!`);
            } else {
              alert("❌ Failed to set alert. Please try again.");
            }
          }
        );

        socket.once(
          "alert_error",
          (response: { success: boolean; error: string }) => {
            alert(`❌ Error: ${response.error}`);
          }
        );
      } else {
        // Fallback to HTTP API if WebSocket not available
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
        const response = await fetch(`${apiUrl}/api/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "demo-user-001",
            symbol: symbol.toUpperCase(),
            type: "PRICE",
            condition: {
              operator:
                Number(alertPrice) > instrument.price ? "above" : "below",
              value: Number(alertPrice),
            },
            message: `${symbol} ${
              Number(alertPrice) > instrument.price
                ? "reached target"
                : "dropped below"
            } ${alertPrice}`,
          }),
        });

        if (response.ok) {
          setAlertSet(true);
          alert(`✅ Price alert set for ${symbol} at $${alertPrice}!`);
        } else {
          throw new Error("HTTP request failed");
        }
      }
    } catch (error) {
      console.error("Failed to set alert:", error);
      alert("❌ Failed to set alert. Please try again.");
    }
  };

  const handleDownloadReport = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      const response = await fetch(
        `${apiUrl}/api/instruments/${symbol}/report`,
        {
          method: "GET",
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${symbol}-analysis-report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download report:", error);
      alert("Failed to download report. Please try again.");
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "STRONG_BUY":
        return "text-green-700 bg-green-100 border-green-200";
      case "BUY":
        return "text-green-600 bg-green-50 border-green-200";
      case "HOLD":
        return "text-gray-600 bg-gray-100 border-gray-200";
      case "SELL":
        return "text-red-600 bg-red-50 border-red-200";
      case "STRONG_SELL":
        return "text-red-700 bg-red-100 border-red-200";
      default:
        return "text-gray-600 bg-gray-100 border-gray-200";
    }
  };

  if (instrumentLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !instrument) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Instrument Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The instrument {symbol} could not be found or there was an error
              loading the data.
            </p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {instrument.symbol}
                  </h1>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {instrument.exchange}
                  </span>
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold border-2 ${getSignalColor(
                      instrument.signal
                    )}`}
                  >
                    {instrument.signal.replace("_", " ")}
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {instrument.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(
                  instrument.price,
                  getCurrencyFromExchange(instrument.exchange)
                )}
              </div>
              <div
                className={`flex items-center justify-end ${
                  instrument.change24h >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {instrument.change24h >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                <span className="font-medium">
                  {instrument.change24h >= 0 ? "+" : ""}
                  {instrument.change24h.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Original market currency (
                {getCurrencyFromExchange(instrument.exchange)})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Chart and Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* TradingView Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div
                id="tradingview_chart"
                ref={chartRef}
                style={{ height: "500px" }}
              >
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Loading advanced chart...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
                  {[
                    { id: "overview", name: "Overview", icon: BarChart3 },
                    { id: "technical", name: "Technical", icon: TrendingUp },
                    {
                      id: "fundamentals",
                      name: "Fundamentals",
                      icon: DollarSign,
                    },
                    { id: "news", name: "Latest News", icon: BookOpen },
                    { id: "reports", name: "Reports", icon: FileText },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? "border-blue-500 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.name}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Key Statistics */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Key Statistics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <DollarSign className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Market Cap
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {instrument.marketCap
                              ? `${getCurrencyFromExchange(
                                  instrument.exchange
                                )} ${formatVolume(instrument.marketCap)}`
                              : "N/A"}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <BarChart3 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Volume
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatVolume(instrument.volume)}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Target className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Sector
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {instrument.sector || "N/A"}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Calendar className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Expected Return
                          </div>
                          <div
                            className={`font-semibold ${
                              instrument.expectedReturn >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatPercentage(instrument.expectedReturn)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analysis Scores */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Analysis Breakdown
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Technical Score
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {instrument.technicalScore}/100
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${instrument.technicalScore}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Fundamental Score
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {instrument.fundamentalScore}/100
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${instrument.fundamentalScore}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Momentum Score
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {instrument.momentumScore}/100
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${instrument.momentumScore}%` }}
                            />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-base font-semibold text-gray-900 dark:text-white">
                              Total Score
                            </span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">
                              {instrument.totalScore}/100
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full"
                              style={{ width: `${instrument.totalScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    {instrument.recommendation && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          AI-Powered Analysis
                        </h3>
                        <div className="space-y-8">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Target Price
                              </div>
                              <div className="font-semibold text-green-600">
                                {formatCurrency(
                                  instrument.recommendation.targetPrice,
                                  getCurrencyFromExchange(instrument.exchange)
                                )}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Stop Loss
                              </div>
                              <div className="font-semibold text-red-600">
                                {instrument.recommendation.stopLoss
                                  ? formatCurrency(
                                      instrument.recommendation.stopLoss,
                                      getCurrencyFromExchange(
                                        instrument.exchange
                                      )
                                    )
                                  : "N/A"}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Time Horizon
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {instrument.recommendation.timeHorizon.replace(
                                  "_",
                                  " "
                                )}
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Recommendation
                              </div>
                              <div
                                className={`font-bold text-lg ${
                                  instrument.recommendation.action === "BUY" ||
                                  instrument.recommendation.action ===
                                    "STRONG_BUY"
                                    ? "text-green-600"
                                    : instrument.recommendation.action ===
                                        "SELL" ||
                                      instrument.recommendation.action ===
                                        "STRONG_SELL"
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {instrument.recommendation.action.replace(
                                  "_",
                                  " "
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {instrument.recommendation.confidence}%
                                confidence
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-blue-100 dark:border-gray-600 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                  Investment Rationale
                                </h4>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <div className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Analysis refreshed hourly • Last:{" "}
                                  {new Date().toLocaleTimeString()}
                                </div>
                                <button
                                  onClick={() => refetchInstrument()}
                                  className="flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                                  title="Refresh analysis with latest data"
                                >
                                  <svg
                                    className="w-3 h-3 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Refresh
                                </button>
                              </div>
                            </div>
                            <div className="prose prose-base max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                              <Markdown remarkPlugins={[remarkGfm]}>
                                {instrument.recommendation.rationale}
                              </Markdown>
                            </div>
                          </div>

                          {instrument.recommendation.keyPoints.length > 0 && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-green-100 dark:border-gray-600 p-6">
                              <div className="flex items-center mb-5">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mr-3">
                                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                  Key Strengths
                                </h4>
                              </div>
                              <div className="space-y-4">
                                {instrument.recommendation.keyPoints.map(
                                  (point, index) => (
                                    <div
                                      key={index}
                                      className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-green-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex items-start">
                                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                          <span className="text-green-600 dark:text-green-400 font-bold text-sm">
                                            {index + 1}
                                          </span>
                                        </div>
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                          <Markdown remarkPlugins={[remarkGfm]}>
                                            {point}
                                          </Markdown>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {instrument.recommendation.risks.length > 0 && (
                            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-red-100 dark:border-gray-600 p-6">
                              <div className="flex items-center mb-5">
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mr-3">
                                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                  Risk Factors
                                </h4>
                              </div>
                              <div className="space-y-4">
                                {instrument.recommendation.risks.map(
                                  (risk, index) => (
                                    <div
                                      key={index}
                                      className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-red-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex items-start">
                                        <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                          <Markdown remarkPlugins={[remarkGfm]}>
                                            {risk}
                                          </Markdown>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {instrument.recommendation.sources &&
                            instrument.recommendation.sources.length > 0 && (
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                                  Sources & Citations
                                </h4>
                                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                                  <ul className="space-y-2">
                                    {instrument.recommendation.sources.map(
                                      (source, index) => (
                                        <li
                                          key={index}
                                          className="flex items-start"
                                        >
                                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mr-2 pt-1">
                                            [{index + 1}]
                                          </span>
                                          <a
                                            href={source.source}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                          >
                                            {source.title}
                                          </a>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "technical" && (
                  <div className="space-y-6">
                    {technicalLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 dark:text-gray-400">
                          Loading technical analysis...
                        </p>
                      </div>
                    ) : technicalData ? (
                      <>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Technical Indicators
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                RSI (14)
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {technicalData.rsi.toFixed(2)}
                              </div>
                              <div
                                className={`text-xs ${
                                  technicalData.rsi > 70
                                    ? "text-red-600"
                                    : technicalData.rsi < 30
                                    ? "text-green-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {technicalData.rsi > 70
                                  ? "Overbought"
                                  : technicalData.rsi < 30
                                  ? "Oversold"
                                  : "Neutral"}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                MACD
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {technicalData.macd.value.toFixed(4)}
                              </div>
                              <div
                                className={`text-xs capitalize ${
                                  technicalData.macd.signal === "bullish"
                                    ? "text-green-600"
                                    : technicalData.macd.signal === "bearish"
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {technicalData.macd.signal}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Trend
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white capitalize">
                                {technicalData.trend}
                              </div>
                              <div
                                className={`text-xs ${
                                  technicalData.trend === "bullish"
                                    ? "text-green-600"
                                    : technicalData.trend === "bearish"
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                Current Direction
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Support & Resistance
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <div className="text-sm text-red-600 dark:text-red-400">
                                Resistance
                              </div>
                              <div className="font-semibold text-red-700 dark:text-red-300">
                                {formatCurrency(
                                  technicalData.resistance,
                                  getCurrencyFromExchange(instrument.exchange)
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-sm text-green-600 dark:text-green-400">
                                Support
                              </div>
                              <div className="font-semibold text-green-700 dark:text-green-300">
                                {formatCurrency(
                                  technicalData.support,
                                  getCurrencyFromExchange(instrument.exchange)
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Moving Averages
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(technicalData.movingAverages).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600"
                                >
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {key.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    {formatCurrency(
                                      value,
                                      getCurrencyFromExchange(
                                        instrument.exchange
                                      )
                                    )}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Technical analysis data not available
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "fundamentals" && (
                  <div className="space-y-6">
                    {fundamentalLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 dark:text-gray-400">
                          Loading fundamental data...
                        </p>
                      </div>
                    ) : fundamentalData ? (
                      <>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Valuation Metrics
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                P/E Ratio
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {fundamentalData.peRatio.toFixed(2)}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                P/B Ratio
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {fundamentalData.pbRatio.toFixed(2)}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                EPS
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(
                                  fundamentalData.eps,
                                  getCurrencyFromExchange(instrument.exchange)
                                )}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                ROE
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {(fundamentalData.roe * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Financial Health
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Debt to Equity
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {fundamentalData.debtToEquity.toFixed(2)}
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Net Margin
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {(fundamentalData.netMargin * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Revenue Growth
                              </div>
                              <div
                                className={`font-semibold ${
                                  fundamentalData.revenueGrowth >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {(fundamentalData.revenueGrowth * 100).toFixed(
                                  1
                                )}
                                %
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Investment Metrics
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Dividend Yield
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {(fundamentalData.dividendYield * 100).toFixed(
                                  2
                                )}
                                %
                              </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Beta
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {fundamentalData.beta.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Fundamental data not available
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "news" && (
                  <div className="space-y-6">
                    {newsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 dark:text-gray-400">
                          Loading latest news...
                        </p>
                      </div>
                    ) : newsData && newsData.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Latest News
                        </h3>
                        <div className="space-y-4">
                          {newsData.map((article) => (
                            <a
                              key={article.id}
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-start space-x-4">
                                {article.imageUrl && (
                                  <img
                                    src={article.imageUrl}
                                    alt={article.title}
                                    className="w-24 h-24 object-cover rounded-md flex-shrink-0"
                                  />
                                )}
                                <div className="flex-grow">
                                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                                    {article.title}
                                  </h4>
                                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{article.source}</span>
                                    <span>&bull;</span>
                                    <span>
                                      {new Date(
                                        article.publishedAt ||
                                          article.discoveredAt
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400">
                          No news available for this instrument
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "reports" && (
                  <div className="space-y-6">
                    {documentsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 dark:text-gray-400">
                          Loading financial reports...
                        </p>
                      </div>
                    ) : documentsData && documentsData.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Financial Reports & Documents
                        </h3>
                        <div className="space-y-4">
                          {documentsData.map((doc, index) => (
                            <div
                              key={index}
                              className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {doc.title}
                                </h4>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    doc.category === "SEC_FILING"
                                      ? "bg-purple-100 text-purple-800"
                                      : doc.category === "RESEARCH"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {doc.category}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  Uploaded:{" "}
                                  {new Date(
                                    doc.uploadedAt
                                  ).toLocaleDateString()}
                                  <span className="ml-2">
                                    Size: {(doc.size / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                                {doc.hasFile && (
                                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                    Download
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400">
                          No financial reports available for this instrument
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Actions & Summary */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <button
                  onClick={handleAddToPortfolio}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Portfolio
                </button>
                <button
                  onClick={handleAddToWatchlist}
                  className={`w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors font-medium ${
                    watchlistAdded
                      ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={watchlistAdded}
                >
                  <Star
                    className={`h-4 w-4 mr-2 ${
                      watchlistAdded ? "fill-current" : ""
                    }`}
                  />
                  {watchlistAdded ? "Added to Watchlist" : "Add to Watchlist"}
                </button>
                <button
                  onClick={handleSetAlert}
                  className={`w-full flex items-center justify-center px-4 py-3 rounded-lg transition-colors font-medium ${
                    alertSet
                      ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                  disabled={alertSet}
                >
                  <Bell
                    className={`h-4 w-4 mr-2 ${alertSet ? "fill-current" : ""}`}
                  />
                  {alertSet ? "Alert Set" : "Set Alert"}
                </button>
                <button
                  onClick={handleDownloadReport}
                  className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </button>
              </div>
            </div>

            {/* Risk Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <Shield className="h-5 w-5 inline mr-2" />
                Risk Summary
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Volatility
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.totalScore > 70
                      ? "Low"
                      : instrument.totalScore > 40
                      ? "Medium"
                      : "High"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Market Risk
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.exchange === "NSE"
                      ? "Emerging Market"
                      : "Developed Market"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Liquidity
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instrument.volume > 1000000
                      ? "High"
                      : instrument.volume > 100000
                      ? "Medium"
                      : "Low"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Signal Strength
                  </span>
                  <span
                    className={`font-medium ${
                      instrument.signal.includes("STRONG")
                        ? "text-green-600"
                        : instrument.signal.includes("BUY") ||
                          instrument.signal.includes("SELL")
                        ? "text-blue-600"
                        : "text-gray-600"
                    }`}
                  >
                    {instrument.signal.includes("STRONG")
                      ? "Strong"
                      : instrument.signal.includes("BUY") ||
                        instrument.signal.includes("SELL")
                      ? "Moderate"
                      : "Weak"}
                  </span>
                </div>
              </div>
            </div>

            {/* External Links */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                External Resources
              </h2>
              <div className="space-y-3">
                <a
                  href={`https://finance.yahoo.com/quote/${instrument.symbol}${
                    instrument.exchange === "NSE" ? ".NS" : ""
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 text-center bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors font-medium"
                >
                  Yahoo Finance
                </a>
                <a
                  href={`https://www.google.com/finance/quote/${instrument.symbol}:${instrument.exchange}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 text-center bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors font-medium"
                >
                  Google Finance
                </a>
                {instrument.exchange === "NSE" && (
                  <a
                    href={`https://www.nseindia.com/get-quotes/equity?symbol=${instrument.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-3 text-center bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors font-medium"
                  >
                    NSE India
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
