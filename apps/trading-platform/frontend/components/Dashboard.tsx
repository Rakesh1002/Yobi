"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CurrencySelector } from "@/components/CurrencySelector";
import {
  WebSocketStatus,
  RealTimePriceDisplay,
  useWebSocket,
} from "@/components/WebSocketProvider";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrendingUpIcon,
  BarChart3Icon,
  EyeIcon,
  ChevronRightIcon,
  Clock,
  Globe,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";

interface Ranking {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number | null;
  change24hPercent: number | null;
  volume24h: number | null;
  marketCap: number | null;
  exchange: string;
  currency: string;
  assetClass: string;
  signal: string;
  signalStrength: number | null;
  technicalScore: number | null;
  fundamentalScore: number | null;
  momentumScore: number | null;
  overallScore: number | null; // Main composite score used for ranking
  compositeScore: number | null; // Same as overallScore, for backend compatibility
  sector?: string;
  industry?: string;
  expectedReturn?: number;
  lastUpdated?: string;
}

type ViewMode = "all" | "nse" | "nasdaq";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

async function fetchRankings(params: {
  limit?: number;
  exchange?: string;
  assetClass?: string;
  signal?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.exchange && params.exchange !== "ALL")
    searchParams.append("exchange", params.exchange);
  if (params.assetClass && params.assetClass !== "ALL")
    searchParams.append("assetClass", params.assetClass);
  if (params.signal && params.signal !== "ALL")
    searchParams.append("signal", params.signal);

  const response = await fetch(`${API_BASE_URL}/api/rankings?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rankings: ${response.statusText}`);
  }
  return response.json();
}

export default function Dashboard() {
  const [selectedExchange, setSelectedExchange] = useState<
    "ALL" | "NASDAQ" | "NSE"
  >("ALL");
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>("ALL");
  const [selectedSignal, setSelectedSignal] = useState<string>("ALL");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [convertedPrices, setConvertedPrices] = useState<
    Record<string, number>
  >({});
  const [isClient, setIsClient] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedInstrument, setSelectedInstrument] = useState<Ranking | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { subscribe } = useWebSocket();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch rankings based on current view mode
  const {
    data: rankingsData,
    refetch,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "rankings",
      viewMode,
      selectedExchange,
      selectedAssetClass,
      selectedSignal,
    ],
    queryFn: async () => {
      const params: any = { limit: 100 };

      // Set exchange filter based on view mode
      if (viewMode === "nse") {
        params.exchange = "NSE";
      } else if (viewMode === "nasdaq") {
        params.exchange = "NASDAQ";
      } else if (selectedExchange !== "ALL") {
        params.exchange = selectedExchange;
      }

      if (selectedAssetClass !== "ALL") {
        params.assetClass = selectedAssetClass;
      }
      if (selectedSignal !== "ALL") {
        params.signal = selectedSignal;
      }

      return await fetchRankings(params);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch instrument details
  const fetchInstrumentDetails = async (symbol: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/instruments/${symbol}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error("Failed to fetch instrument details:", error);
    }
    return null;
  };

  const handleViewDetails = async (ranking: Ranking) => {
    setSelectedInstrument(ranking);
    setShowDetailModal(true);

    // Fetch additional details
    const details = await fetchInstrumentDetails(ranking.symbol);
    if (details) {
      setSelectedInstrument({ ...ranking, ...details });
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedInstrument(null);
  };

  // Currency conversion helper - ONLY for dashboard display
  const convertPrice = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/currency/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          from: fromCurrency.toUpperCase(),
          to: toCurrency.toUpperCase(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        return data.data.convertedAmount;
      }
      return amount;
    } catch (error) {
      console.error("Currency conversion failed:", error);
      return amount;
    }
  };

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Convert prices when currency changes - ONLY for dashboard
  useEffect(() => {
    const convertAllPrices = async () => {
      if (!rankingsData?.data || selectedCurrency === "USD") {
        setConvertedPrices({});
        return;
      }

      const conversions: Record<string, number> = {};
      for (const ranking of rankingsData.data.slice(0, 20)) {
        // Convert first 20 for performance
        const originalCurrency = ranking.currency || "USD";
        if (originalCurrency !== selectedCurrency && ranking.price) {
          try {
            const converted = await convertPrice(
              ranking.price,
              originalCurrency,
              selectedCurrency
            );
            conversions[ranking.symbol] = converted;
          } catch (error) {
            console.warn(`Failed to convert ${ranking.symbol} price:`, error);
          }
        }
      }
      setConvertedPrices(conversions);
    };

    convertAllPrices();
  }, [selectedCurrency, rankingsData]);

  // Subscribe to real-time updates for visible symbols
  useEffect(() => {
    if (rankingsData?.data?.length > 0) {
      const symbols = rankingsData.data
        .slice(0, 20)
        .map((r: Ranking) => r.symbol);
      subscribe(symbols, "quotes");
    }
  }, [rankingsData, subscribe]);

  // Filter rankings based on search query
  const allRankings = rankingsData?.data || [];
  const filteredRankings = allRankings.filter(
    (ranking: Ranking) =>
      ranking.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ranking.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ranking.sector &&
        ranking.sector.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const rankings = searchQuery ? filteredRankings : allRankings;

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "STRONG_BUY":
        return "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "BUY":
        return "text-green-600 bg-green-50 dark:text-green-500 dark:bg-green-900/10";
      case "HOLD":
        return "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "SELL":
        return "text-red-600 bg-red-50 dark:text-red-500 dark:bg-red-900/10";
      case "STRONG_SELL":
        return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700";
    }
  };

  // Dashboard-specific price display with currency conversion
  const getDisplayPrice = (ranking: Ranking) => {
    const originalCurrency = ranking.currency || "USD";
    const convertedPrice = convertedPrices[ranking.symbol];
    const price = convertedPrice || ranking.price || 0;
    const currency = convertedPrice ? selectedCurrency : originalCurrency;
    return formatCurrency(price, currency);
  };

  const getViewModeTitle = () => {
    switch (viewMode) {
      case "all":
        return "Top 100 Overall";
      case "nse":
        return "NSE Top 100";
      case "nasdaq":
        return "NASDAQ Top 100";
      default:
        return "Investment Rankings";
    }
  };

  const getViewModeDescription = () => {
    switch (viewMode) {
      case "all":
        return `Showing top 100 instruments across all exchanges, ranked by composite score`;
      case "nse":
        return `Showing top 100 instruments from National Stock Exchange (India), ranked by composite score`;
      case "nasdaq":
        return `Showing top 100 instruments from NASDAQ (USA), ranked by composite score`;
      default:
        return "Investment rankings based on composite score";
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Error Loading Data
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">
              Failed to load market data. Please check your connection and try
              again.
            </p>
            <button
              onClick={() => refetch()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Retry
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Trading Intelligence Dashboard
              </h1>
              <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4 mr-2" />
                <WebSocketStatus />
                <span className="ml-2">
                  Last updated:{" "}
                  {isClient ? new Date().toLocaleTimeString() : "--:--:--"}
                </span>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
              <CurrencySelector
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                className="w-full sm:w-auto"
              />
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setViewMode("all")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === "all"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                🌍 All Markets (Top 100)
              </button>
              <button
                onClick={() => setViewMode("nse")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === "nse"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                🇮🇳 NSE Top 100
              </button>
              <button
                onClick={() => setViewMode("nasdaq")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  viewMode === "nasdaq"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                🇺🇸 NASDAQ Top 100
              </button>
            </nav>
          </div>
        </div>

        {/* Filters - Only show for 'all' view */}
        {viewMode === "all" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">
                  🔍 Filters:
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by symbol, name, or sector..."
                  className="px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              <select
                value={selectedExchange}
                onChange={(e) =>
                  setSelectedExchange(
                    e.target.value as "ALL" | "NASDAQ" | "NSE"
                  )
                }
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Exchanges</option>
                <option value="NASDAQ">🇺🇸 NASDAQ</option>
                <option value="NSE">🇮🇳 NSE</option>
              </select>

              <select
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Signals</option>
                <option value="STRONG_BUY">🚀 Strong Buy</option>
                <option value="BUY">📈 Buy</option>
                <option value="HOLD">⏸️ Hold</option>
                <option value="SELL">📉 Sell</option>
                <option value="STRONG_SELL">🔻 Strong Sell</option>
              </select>

              <div className="ml-auto flex items-center text-xs text-gray-500 dark:text-gray-400">
                Currency:{" "}
                <span className="ml-1 font-semibold text-blue-600">
                  {selectedCurrency}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getViewModeTitle()}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {getViewModeDescription()}
                </p>
              </div>
              <BarChart3Icon className="h-6 w-6 text-gray-400" />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Loading rankings...
              </p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No rankings available
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      RANK
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SYMBOL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      PRICE (LIVE)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      24H CHANGE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SCORE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      SIGNAL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rankings.map((ranking: Ranking, index: number) => (
                    <tr
                      key={`${ranking.symbol}-${index}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/instrument/${ranking.symbol}`}
                          className="flex flex-col group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md p-2 -m-2 transition-colors duration-150"
                        >
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                            {ranking.symbol}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 truncate max-w-32 transition-colors">
                            {ranking.name}
                          </span>
                          {ranking.exchange && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                              {ranking.exchange === "NSE"
                                ? "🇮🇳"
                                : ranking.exchange === "NASDAQ"
                                ? "🇺🇸"
                                : "🌍"}{" "}
                              {ranking.exchange}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {getDisplayPrice(ranking)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Live • {ranking.currency || "USD"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${
                            (ranking.change24hPercent ?? 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {(ranking.change24hPercent ?? 0) >= 0 ? "+" : ""}
                          {(ranking.change24hPercent ?? 0).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {ranking.change24h
                            ? formatLargeNumber(ranking.change24h)
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 mr-3 max-w-[80px]">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full"
                              style={{
                                width: `${Math.min(
                                  ranking.overallScore || 0,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {(ranking.overallScore || 0).toFixed(0)}
                          </span>
                        </div>
                        {/* Enhanced scores display */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                          <div>
                            T: {(ranking.technicalScore ?? 0).toFixed(0)} | F:{" "}
                            {(ranking.fundamentalScore ?? 0).toFixed(0)} | M:{" "}
                            {(ranking.momentumScore ?? 0).toFixed(0)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSignalColor(
                            ranking.signal
                          )}`}
                        >
                          {ranking.signal.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                        <button
                          onClick={() => handleViewDetails(ranking)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <EyeIcon className="h-3 w-3 mr-1" />
                          Details
                        </button>
                        <Link
                          href={`/instrument/${ranking.symbol}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Analyze
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Instrument Detail Modal */}
      {showDetailModal && selectedInstrument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedInstrument.symbol}
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                    {selectedInstrument.name}
                  </p>
                  <div className="flex items-center mt-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {selectedInstrument.exchange === "NSE"
                        ? "🇮🇳"
                        : selectedInstrument.exchange === "NASDAQ"
                        ? "🇺🇸"
                        : "🌍"}{" "}
                      {selectedInstrument.exchange}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedInstrument.sector}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Price and Signal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current Price
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {getDisplayPrice(selectedInstrument)}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    AI Signal
                  </p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(
                      selectedInstrument.signal
                    )}`}
                  >
                    {selectedInstrument.signal.replace("_", " ")}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    24h Change
                  </p>
                  <p
                    className={`text-xl font-semibold ${
                      (selectedInstrument.change24hPercent ?? 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(selectedInstrument.change24hPercent ?? 0) >= 0 ? "+" : ""}
                    {(selectedInstrument.change24hPercent ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Composite Score Display */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Composite Score (Ranking Basis)
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-base mb-2">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Composite Score
                      </span>
                      <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
                        {(selectedInstrument.overallScore ?? 0).toFixed(0)}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full"
                        style={{
                          width: `${Math.min(
                            selectedInstrument.overallScore ?? 0,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This composite score determines the ranking and is
                      calculated using the breakdown below.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Technical Score
                      </span>
                      <span className="font-medium">
                        {(selectedInstrument.technicalScore ?? 0).toFixed(0)}
                        /100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            selectedInstrument.technicalScore ?? 0,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Fundamental Score
                      </span>
                      <span className="font-medium">
                        {(selectedInstrument.fundamentalScore ?? 0).toFixed(0)}
                        /100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            selectedInstrument.fundamentalScore ?? 0,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Momentum Score
                      </span>
                      <span className="font-medium">
                        {(selectedInstrument.momentumScore ?? 0).toFixed(0)}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            selectedInstrument.momentumScore ?? 0,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Volume and Market Cap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Volume
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedInstrument.volume24h
                      ? formatLargeNumber(selectedInstrument.volume24h)
                      : "N/A"}
                  </p>
                </div>
                {selectedInstrument.marketCap && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Market Cap
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatLargeNumber(selectedInstrument.marketCap)}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={closeDetailModal}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <Link
                  href={`/instrument/${selectedInstrument.symbol}`}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                  onClick={closeDetailModal}
                >
                  Deep Analysis
                </Link>
                <button
                  onClick={() => {
                    window.open(
                      `https://finance.yahoo.com/quote/${
                        selectedInstrument.symbol
                      }${selectedInstrument.exchange === "NSE" ? ".NS" : ""}`,
                      "_blank"
                    );
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Yahoo Finance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
