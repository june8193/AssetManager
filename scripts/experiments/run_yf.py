"""yfinance 라이브러리를 사용하여 주식 정보 조회 및 검색 API를 테스트하는 스크립트.

이 스크립트는 AAPL, NVDA 등의 심볼을 사용하여 검색(Search), 티커 기본 정보(fast_info),
그리고 실시간 분 단위 시세 데이터를 가져오는 동작을 테스트합니다.
"""
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
