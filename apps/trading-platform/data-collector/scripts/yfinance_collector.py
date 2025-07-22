#!/usr/bin/env python3
"""
yfinance Data Collector Script
Fetches real-time and historical market data using the free yfinance library
Called by the Node.js data collector service
"""

import yfinance as yf
import json
import sys
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import argparse

class YFinanceCollector:
    def __init__(self):
        self.session = None
    
    def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get real-time quote for a single symbol"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            hist = ticker.history(period="2d")  # Get last 2 days for previous close
            
            if hist.empty:
                raise ValueError(f"No data found for {symbol}")
            
            latest = hist.iloc[-1]
            previous = hist.iloc[-2] if len(hist) >= 2 else latest
            
            quote = {
                "symbol": symbol.upper(),
                "name": info.get("longName", info.get("shortName", symbol)),
                "price": float(latest["Close"]),
                "change": float(latest["Close"] - previous["Close"]),
                "changePercent": float((latest["Close"] - previous["Close"]) / previous["Close"] * 100),
                "volume": int(latest["Volume"]) if not pd.isna(latest["Volume"]) else 0,
                "high": float(latest["High"]),
                "low": float(latest["Low"]),
                "open": float(latest["Open"]),
                "previousClose": float(previous["Close"]),
                "marketCap": info.get("marketCap"),
                "timestamp": datetime.now().isoformat(),
                "source": "yfinance"
            }
            
            return quote
            
        except Exception as e:
            return {"error": str(e), "symbol": symbol}
    
    def get_multiple_quotes(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Get quotes for multiple symbols efficiently"""
        quotes = []
        
        try:
            # Use yfinance bulk download for efficiency
            tickers = yf.Tickers(' '.join(symbols))
            
            for symbol in symbols:
                try:
                    ticker = tickers.tickers[symbol]
                    info = ticker.info
                    hist = ticker.history(period="2d")
                    
                    if not hist.empty:
                        latest = hist.iloc[-1]
                        previous = hist.iloc[-2] if len(hist) >= 2 else latest
                        
                        quote = {
                            "symbol": symbol.upper(),
                            "name": info.get("longName", info.get("shortName", symbol)),
                            "price": float(latest["Close"]),
                            "change": float(latest["Close"] - previous["Close"]),
                            "changePercent": float((latest["Close"] - previous["Close"]) / previous["Close"] * 100),
                            "volume": int(latest["Volume"]) if not pd.isna(latest["Volume"]) else 0,
                            "high": float(latest["High"]),
                            "low": float(latest["Low"]),
                            "open": float(latest["Open"]),
                            "previousClose": float(previous["Close"]),
                            "marketCap": info.get("marketCap"),
                            "timestamp": datetime.now().isoformat(),
                            "source": "yfinance"
                        }
                        quotes.append(quote)
                    else:
                        quotes.append({"error": "No data found", "symbol": symbol})
                        
                except Exception as e:
                    quotes.append({"error": str(e), "symbol": symbol})
            
        except Exception as e:
            return [{"error": f"Bulk fetch failed: {str(e)}"}]
        
        return quotes
    
    def get_historical_data(self, symbol: str, period: str = "1y") -> Dict[str, Any]:
        """Get historical data for a symbol"""
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            
            if hist.empty:
                raise ValueError(f"No historical data found for {symbol}")
            
            data_points = []
            for date, row in hist.iterrows():
                data_points.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0
                })
            
            return {
                "symbol": symbol.upper(),
                "period": period,
                "interval": "1d",
                "data": data_points,
                "source": "yfinance"
            }
            
        except Exception as e:
            return {"error": str(e), "symbol": symbol}
    
    def get_company_info(self, symbol: str) -> Dict[str, Any]:
        """Get fundamental company information"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Extract key fundamental metrics
            fundamentals = {
                "symbol": symbol.upper(),
                "marketCap": info.get("marketCap"),
                "enterpriseValue": info.get("enterpriseValue"),
                "peRatio": info.get("trailingPE"),
                "forwardPE": info.get("forwardPE"),
                "pegRatio": info.get("pegRatio"),
                "psRatio": info.get("priceToSalesTrailing12Months"),
                "pbRatio": info.get("priceToBook"),
                "evToRevenue": info.get("enterpriseToRevenue"),
                "evToEbitda": info.get("enterpriseToEbitda"),
                "beta": info.get("beta"),
                "eps": info.get("trailingEps"),
                "revenue": info.get("totalRevenue"),
                "grossMargin": info.get("grossMargins"),
                "operatingMargin": info.get("operatingMargins"),
                "profitMargin": info.get("profitMargins"),
                "roe": info.get("returnOnEquity"),
                "roa": info.get("returnOnAssets"),
                "debtToEquity": info.get("debtToEquity"),
                "currentRatio": info.get("currentRatio"),
                "quickRatio": info.get("quickRatio"),
                "dividendYield": info.get("dividendYield"),
                "payoutRatio": info.get("payoutRatio"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "lastUpdated": datetime.now().isoformat(),
                "source": "yfinance"
            }
            
            return fundamentals
            
        except Exception as e:
            return {"error": str(e), "symbol": symbol}

def main():
    parser = argparse.ArgumentParser(description="yfinance Data Collector")
    parser.add_argument("action", choices=["quote", "quotes", "historical", "fundamentals"], 
                       help="Action to perform")
    parser.add_argument("--symbols", nargs="+", required=True, 
                       help="Stock symbols to fetch")
    parser.add_argument("--period", default="1y", 
                       help="Period for historical data (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)")
    
    args = parser.parse_args()
    
    collector = YFinanceCollector()
    
    try:
        if args.action == "quote":
            result = collector.get_quote(args.symbols[0])
        elif args.action == "quotes":
            result = collector.get_multiple_quotes(args.symbols)
        elif args.action == "historical":
            result = collector.get_historical_data(args.symbols[0], args.period)
        elif args.action == "fundamentals":
            result = collector.get_company_info(args.symbols[0])
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {"error": str(e), "action": args.action, "symbols": args.symbols}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main() 