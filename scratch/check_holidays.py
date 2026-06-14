# -*- coding: utf-8 -*-
import datetime
import holidays

def main():
    # 2026년 한국 공휴일 출력
    kr_holidays = holidays.SouthKorea(years=2026)
    print("--- 2026 South Korea Holidays ---")
    for date, name in sorted(kr_holidays.items()):
        print(f"{date}: {name!r} (escape: {name.encode('utf-8')})")
        
    # 2026년 미국 NYSE 공휴일 출력
    nyse_holidays = holidays.NYSE(years=2026)
    print("\n--- 2026 NYSE Holidays ---")
    for date, name in sorted(nyse_holidays.items()):
        print(f"{date}: {name}")

if __name__ == "__main__":
    main()
