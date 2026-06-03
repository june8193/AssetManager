import asyncio
import yfinance as yf
from src.kiwoom.api import KiwoomAPI
from src.kiwoom.auth import KiwoomAuthManager

async def test_yfinance():
    print("=== yfinance 조회 테스트 ===")
    us_tickers = ["GOOGL", "NVDA"]
    kr_tickers = ["005930.KS", "000660.KS"]
    
    # 미국 주식 조회
    for ticker_name in us_tickers:
        try:
            ticker = yf.Ticker(ticker_name)
            info = ticker.info
            shares = info.get('sharesOutstanding')
            cap = info.get('marketCap')
            print(f"[{ticker_name}]")
            print(f"  상장주식수 (sharesOutstanding): {shares:,.0f} 주" if shares else "  상장주식수: 없음")
            print(f"  시가총액 (marketCap): ${cap:,.2f}" if cap else "  시가총액: 없음")
        except Exception as e:
            print(f"[{ticker_name}] yfinance 조회 실패: {e}")
            
    # 한국 주식 yfinance 조회
    for ticker_name in kr_tickers:
        try:
            ticker = yf.Ticker(ticker_name)
            info = ticker.info
            shares = info.get('sharesOutstanding')
            cap = info.get('marketCap')
            print(f"[{ticker_name}] (yfinance)")
            print(f"  상장주식수 (sharesOutstanding): {shares:,.0f} 주" if shares else "  상장주식수: 없음")
            print(f"  시가총액 (marketCap): {cap:,.0f} 원" if cap else "  시가총액: 없음")
        except Exception as e:
            print(f"[{ticker_name}] yfinance 조회 실패: {e}")

async def test_kiwoom():
    print("\n=== 키움 API 조회 테스트 ===")
    api = KiwoomAPI()
    auth = KiwoomAuthManager()
    try:
        token = await auth.get_valid_token()
        for code in ["005930", "000660"]:
            res = api.get_stock_info(token, code)
            if res:
                cur_prc = float(res.get("cur_prc", "0").strip("+- "))
                mac = float(res.get("mac", "0"))
                flo_stk = float(res.get("flo_stk", "0"))
                stk_nm = res.get("stk_nm", "")
                
                calculated_shares = (mac * 1000000) / cur_prc if cur_prc > 0 else 0
                flo_stk_actual = flo_stk * 10
                
                print(f"[{stk_nm} ({code})]")
                print(f"  현재가 (cur_prc): {cur_prc:,.0f} 원")
                print(f"  시가총액 (mac): {mac * 1000000:,.0f} 원 ({mac/10000:,.1f} 억 원)")
                print(f"  상장주식수 (flo_stk * 10): {flo_stk_actual:,.0f} 주")
                print(f"  시총/현재가 역산 주식수: {calculated_shares:,.0f} 주")
            else:
                print(f"{code} 키움 API 조회 실패")
    except Exception as e:
        print(f"키움 API 테스트 에러: {e}")

async def main():
    await test_yfinance()
    await test_kiwoom()

if __name__ == "__main__":
    asyncio.run(main())
