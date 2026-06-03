import yfinance as yf
import datetime

def test_vkospi():
    tickers = ["^VKOSPI", "VKOSPI", "KSVKOSPI", "^VIX"]
    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=365)
    
    for ticker in tickers:
        print(f"--- Fetching {ticker} ---")
        try:
            df = yf.download(ticker, start=start_date, end=today, progress=False)
            if df.empty:
                print(f"{ticker}: Data is empty")
            else:
                print(f"{ticker}: Successfully fetched {len(df)} rows")
                print(df.tail(2))
        except Exception as e:
            print(f"{ticker}: Error - {e}")

if __name__ == "__main__":
    test_vkospi()
