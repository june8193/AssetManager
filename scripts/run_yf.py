import yfinance as yf
import json

def test_search(query):
    print(f"--- Searching for: {query} ---")
    try:
        # yfinance.Search might not be available in all versions, let's try
        search = yf.Search(query, max_results=10)
        print(f"Quotes: {search.quotes}")
    except Exception as e:
        print(f"Search failed: {e}")

def test_ticker_info(symbol):
    print(f"--- Ticker Info: {symbol} ---")
    try:
        ticker = yf.Ticker(symbol)
        # fast_info is a good way to get basic info quickly
        info = ticker.fast_info
        print(f"Last Price: {info['lastPrice']}")
        print(f"Currency: {info['currency']}")
        print(f"Market Cap: {info['marketCap']}")
        
        # Regular info (slower but more detailed)
        # full_info = ticker.info
        # print(f"Long Name: {full_info.get('longName')}")
    except Exception as e:
        print(f"Ticker info failed: {e}")

def test_real_time_quote(symbol):
    print(f"--- Real-time Quote (1m interval): {symbol} ---")
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="1d", interval="1m")
        if not data.empty:
            last_quote = data.iloc[-1]
            print(f"Time: {data.index[-1]}")
            print(f"Close: {last_quote['Close']}")
        else:
            print("No data found")
    except Exception as e:
        print(f"Real-time quote failed: {e}")

if __name__ == "__main__":
    test_search("Apple")
    test_search("NVDA")
    test_ticker_info("AAPL")
    test_real_time_quote("AAPL")
