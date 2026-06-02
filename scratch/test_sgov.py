# test_sgov.py
# Single ticker yf.download column access test

import asyncio
import yfinance as yf
import pandas as pd
from fastapi.concurrency import run_in_threadpool

async def main():
    formatted_other = ["SGOV"]
    print("--- Testing data['Close'][ft] for single ticker ---")
    try:
        data = await run_in_threadpool(
            yf.download,
            formatted_other,
            period="1d",
            interval="1m",
            progress=False
        )
        print("data.columns:", data.columns)
        
        ft = "SGOV"
        close_data = data['Close']
        print("Type of data['Close']:", type(close_data))
        
        # 1. 기존 방식 (len == 1)
        try:
            val_orig = close_data.dropna().iloc[-1]
            print("Original way value:", val_orig, "Type:", type(val_orig))
            float(val_orig)
        except Exception as e:
            print("Original way failed as expected:", e)
            
        # 2. 제안하는 방식 (열 직접 접근)
        try:
            if isinstance(close_data, pd.DataFrame):
                if ft in close_data.columns:
                    series = close_data[ft]
                else:
                    series = close_data.iloc[:, 0]
            else:
                series = close_data
                
            val_new = float(series.dropna().iloc[-1])
            print("Proposed way succeeded! Value:", val_new)
        except Exception as e:
            print("Proposed way failed:", e)

    except Exception as e:
        print("Error during setup:", e)

if __name__ == "__main__":
    asyncio.run(main())
