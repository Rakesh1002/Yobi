#!/usr/bin/env python3
"""
NSE India Symbol Fetcher
Gets comprehensive list of NSE equity symbols for data collection
"""

import json
import sys
import requests
import pandas as pd
import yfinance as yf
from typing import List, Dict

class NSESymbolFetcher:
    def __init__(self):
        self.base_symbols = [
            # Nifty 50 - Top 50 stocks
            "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK",
            "BHARTIARTL", "ITC", "SBIN", "LT", "ASIANPAINT", "AXISBANK", "MARUTI", "HCLTECH",
            "BAJFINANCE", "WIPRO", "ULTRACEMCO", "NESTLEIND", "ONGC", "TATAMOTORS", "SUNPHARMA",
            "NTPC", "POWERGRID", "M&M", "TECHM", "TITAN", "COALINDIA", "INDUSINDBK", "ADANIPORTS",
            "BAJAJFINSV", "HDFCLIFE", "SBILIFE", "BRITANNIA", "DIVISLAB", "DRREDDY", "EICHERMOT",
            "BAJAJ-AUTO", "HEROMOTOCO", "HINDALCO", "CIPLA", "GRASIM", "TATASTEEL", "UPL",
            "JSWSTEEL", "APOLLOHOSP", "TATACONSUM", "ADANIENT", "LTIM", "BPCL", "INDIGO",
            
            # Nifty Next 50 - Additional important stocks
            "ADANIGREEN", "ADANITRANS", "AMBUJACEM", "BANDHANBNK", "BERGEPAINT", "BIOCON",
            "BOSCHLTD", "CANFINHOME", "CHOLAFIN", "COLPAL", "CONCOR", "COFORGE", "DABUR",
            "DALBHARAT", "DEEPAKNTR", "DELTACORP", "DIXON", "DLF", "GAIL", "GODREJCP",
            "GODREJPROP", "HAVELLS", "ICICIGI", "ICICIPRULI", "IDFCFIRSTB", "INDUSTOWER",
            "IOC", "IRCTC", "JINDALSTEL", "JUBLFOOD", "LICHSGFIN", "LUPIN", "MARICO",
            "MINDTREE", "MUTHOOTFIN", "NMDC", "NYKAA", "OBEROIRLTY", "OFSS", "PAGEIND",
            "PETRONET", "PIDILITIND", "PIIND", "PNB", "POLICYBZR", "PVR", "RBLBANK",
            "SAIL", "SHREECEM", "SIEMENS", "SRF", "TORNTPHARM", "TRENT", "TVSMOTOR",
            "VOLTAS", "ZEEL", "ZOMATO", "MCDOWELL-N"
        ]
    
    def get_nse_symbols_from_file(self) -> List[str]:
        """Get NSE symbols from a comprehensive list"""
        try:
            # NSE All Equity symbols (major ones)
            nse_symbols = [
                # Banking & Financial Services
                "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK",
                "BANDHANBNK", "FEDERALBNK", "IDFCFIRSTB", "PNB", "BANKBARODA", "CANBK",
                "UNIONBANK", "INDIANB", "RBLBANK", "YESBANK", "AUBANK", "EQUITASBNK",
                
                # IT & Technology
                "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM", "MINDTREE", "COFORGE",
                "MPHASIS", "PERSISTENT", "LTTS", "OFSS", "HEXAWARE", "CYIENT", "SONACOMS",
                
                # Oil & Gas
                "RELIANCE", "ONGC", "IOC", "BPCL", "HINDPETRO", "GAIL", "OIL", "MGL",
                "IGL", "PETRONET", "GSPL", "ATGL",
                
                # Automobiles
                "MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT",
                "TVSMOTOR", "ASHOKLEY", "BALKRISIND", "MRF", "APOLLOTYRE", "CEAT",
                
                # Pharmaceuticals
                "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN", "BIOCON", "CADILAHC",
                "AUROPHARMA", "TORNTPHARM", "GLENMARK", "ALKEM", "LALPATHLAB", "METROPOLIS",
                
                # Consumer Goods
                "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP",
                "COLPAL", "EMAMILTD", "BAJAJCON", "VBL", "RADICO", "UBL", "JUBLFOOD",
                
                # Metals & Mining
                "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA", "NMDC", "SAIL",
                "JINDALSTEL", "RATNAMANI", "WELCORP", "MOIL", "MANGALAM",
                
                # Infrastructure & Construction
                "LT", "ULTRACEMCO", "SHREECEM", "AMBUJACEM", "ACC", "RAMCOCEM", "HEIDELBERG",
                "JKCEMENT", "ORIENTCEM", "PRISMCEM", "BANGALOREPO", "DLF", "OBEROIRLTY",
                "PRESTIGE", "GODREJPROP", "BRIGADE", "SOBHA", "MAHLIFE",
                
                # Power & Utilities
                "NTPC", "POWERGRID", "ADANIGREEN", "ADANITRANS", "TATAPOWER", "NHPC",
                "SJVN", "PFC", "RECLTD", "IREDA",
                
                # Telecom
                "BHARTIARTL", "INDUS", "GTPL", "TEJAS",
                
                # Retail & E-commerce
                "ZOMATO", "NYKAA", "POLICYBZR", "PAYTM", "TRENT", "ADITYADAYA", "WESTLIFE",
                "JUBILANT", "SPENCERS", "SHOPERSTOP",
                
                # Airlines & Travel
                "INDIGO", "SPICEJET", "IRCTC",
                
                # Entertainment & Media
                "ZEEL", "SUNTV", "PVRINOX", "INOXLEISUR", "EROS", "BALAJITELE",
                
                # Healthcare Services
                "APOLLOHOSP", "FORTIS", "MAXHEALTH", "NARAYANAHEM", "RAINBOWHTN",
                
                # Chemicals & Fertilizers
                "UPL", "SRF", "PIDILITIND", "DEEPAKNTR", "TATACHEM", "BASF", "AKZOINDIA",
                "NOCIL", "ALKYLAMINE", "CLEAN", "CAMS",
                
                # Agriculture & Food Processing
                "BRITANNIA", "GODREJAGRO", "RALLIS", "PI", "CHAMBLFERT", "COROMANDEL",
                
                # Textiles
                "GRASIM", "VARDHMAN", "RSWM", "TRIDENT", "WELSPUN", "PAGEIND",
                
                # Diversified
                "ADANIENT", "IPCALAB", "DIXON", "VOLTAS", "BLUEDART", "CONCOR"
            ]
            
            return sorted(list(set(nse_symbols)))  # Remove duplicates and sort
            
        except Exception as e:
            print(f"Error getting NSE symbols: {e}")
            return self.base_symbols
    
    def validate_symbols(self, symbols: List[str]) -> List[Dict]:
        """Validate symbols with yfinance and get basic info"""
        validated_symbols = []
        
        print(f"Validating {len(symbols)} NSE symbols...")
        
        for i, symbol in enumerate(symbols):
            try:
                # Add .NS suffix for NSE
                yahoo_symbol = f"{symbol}.NS"
                ticker = yf.Ticker(yahoo_symbol)
                info = ticker.info
                
                if 'symbol' in info or 'shortName' in info:
                    validated_symbols.append({
                        'symbol': symbol,
                        'yahoo_symbol': yahoo_symbol,
                        'name': info.get('shortName', info.get('longName', symbol)),
                        'sector': info.get('sector', 'Unknown'),
                        'industry': info.get('industry', 'Unknown'),
                        'currency': info.get('currency', 'INR'),
                        'exchange': 'NSE',
                        'country': 'India'
                    })
                    
                if (i + 1) % 20 == 0:
                    print(f"Validated {i + 1}/{len(symbols)} symbols...")
                    
            except Exception as e:
                print(f"Failed to validate {symbol}: {e}")
                continue
        
        print(f"Successfully validated {len(validated_symbols)} symbols out of {len(symbols)}")
        return validated_symbols
    
    def get_popular_nse_symbols(self) -> List[str]:
        """Get just the most popular NSE symbols for quick testing"""
        return [
            "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK",
            "BHARTIARTL", "ITC", "SBIN", "LT", "ASIANPAINT", "AXISBANK", "MARUTI", "HCLTECH",
            "BAJFINANCE", "WIPRO", "ULTRACEMCO", "NESTLEIND", "ONGC", "TATAMOTORS", "SUNPHARMA",
            "NTPC", "POWERGRID", "M&M", "TECHM", "TITAN", "COALINDIA", "INDUSINDBK", "ADANIPORTS"
        ]

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch NSE symbols")
    parser.add_argument("--mode", choices=["popular", "all", "validate"], default="popular",
                       help="Mode: popular (30 symbols), all (300+ symbols), validate (test symbols)")
    args = parser.parse_args()
    
    fetcher = NSESymbolFetcher()
    
    if args.mode == "popular":
        symbols = fetcher.get_popular_nse_symbols()
        result = {
            "mode": "popular",
            "count": len(symbols),
            "symbols": symbols,
            "exchange": "NSE",
            "suffix": ".NS"
        }
    elif args.mode == "all":
        symbols = fetcher.get_nse_symbols_from_file()
        result = {
            "mode": "all",
            "count": len(symbols),
            "symbols": symbols,
            "exchange": "NSE", 
            "suffix": ".NS"
        }
    elif args.mode == "validate":
        symbols = fetcher.get_popular_nse_symbols()[:10]  # Test with 10 symbols
        validated = fetcher.validate_symbols(symbols)
        result = {
            "mode": "validate",
            "requested": len(symbols),
            "validated": len(validated),
            "instruments": validated
        }
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 