# -*- coding: utf-8 -*-
"""2026-09-25 미국 시장 일일 지수 현황 보고서 파일 생성 스크립트."""

import subprocess
from pathlib import Path


def main():
    # 저장 경로 확인
    proc = subprocess.run(
        ["uv", "run", "python", "scripts/get_storage_dir.py"],
        capture_output=True,
        text=True,
        check=True,
    )
    storage_dir = Path(proc.stdout.strip())
    report_dir = storage_dir / "reports" / "us_market" / "daily"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_file = report_dir / "US_market_daily_report_20260925.md"

    content = """# 🇺🇸 미국 시장 일일 지수 현황 (2026-09-25)
> 한국 시간: 2026-09-25 07:05 / 현지 기준: 2026-09-24

### 📊 3대 주요 지수 마감 현황
- **S&P 500**: 7,687.87 (-29.03pt, -0.38%)
- **NASDAQ**: 26,796.57 (-121.68pt, -0.45%)
- **DOW JONES**: 51,511.59 (-352.10pt, -0.68%)

### 🌡️ 변동성 지수 (VIX) 모니터링
- **VIX 지수**: 15.18 (+0.97pt)
- **리스크 등급**: 🟢 안정 (시장 심리 안정)
- **시장 심리 진단**: VIX 지수가 전일 대비 +0.97pt 반등하여 15.18을 기록했으나 여전히 20 미만 안정권에 머물며 시장 전반의 하락 조정에도 급격한 불안 심리나 변동성 확대 없이 차분한 흐름을 유지하고 있습니다.

### 📰 주요 뉴스 및 시황 요약
- **[Stock market today: Dow, S&P 500, Nasdaq trims losses as hopes of Hormuz deal offset rising bond yields](https://finance.yahoo.com/markets/live/stock-market-today-thursday-september-24-dow-sp-500-nasdaq-080352893.html)**: 미 국채 수익률 상승세 지속에도 불구하고 호르무즈 해협 관련 긴장 완화 협상 기대감이 반영되며 뉴욕 증시 3대 지수가 장 후반 낙폭을 일부 축소하며 마감했습니다.
- **[Dow Jones Futures: Market Rally Resilient As Yields, Oil Prices Keep Rising; Tesla Event On Deck](https://www.investors.com/market-trend/stock-market-today/dow-jones-futures-market-rally-resilient-yields-oil-prices-rising-tesla-semi-event/?src=A00220&yptr=yahoo)**: 국채 금리와 유가 상승 압박 속에서도 주식 시장 랠리가 견조한 복원력을 나타내고 있으며, 테슬라 행사 등 대형 기술주 주요 이벤트를 앞두고 관망세가 형성되었습니다.
- **[High Dividend ETFs Are Beating the S&P 500 Again in 2026 and These 3 Pay Over 3 Percent While Doing It](https://finance.yahoo.com/markets/stocks/articles/high-dividend-etfs-beating-p-213844874.html)**: 지수 밸류에이션 부담과 고금리 환경에 대응하여 S&P 500 대비 방어적 성향과 안정적 배당을 갖춘 고배당 ETF들이 초과 성과를 기록하며 자금 유입세를 보이고 있습니다.
- **[The Market Looks Expensive. This ETF Pays a 11.86% Yield While You Wait for It to Come Down](https://finance.yahoo.com/markets/options/articles/market-looks-expensive-etf-pays-215247508.html)**: 증시 전반의 고평가 논란 속에서 조정에 대비해 현금 흐름을 확보할 수 있는 고배당 커버드콜 및 인컴형 ETF에 대한 시장 관심이 이어지고 있습니다.
- **[SPY’s 9.45 Basis Points Hides $6,450 a Decade on $100,000 Versus Cheaper Peers](https://finance.yahoo.com/markets/stocks/articles/spy-9-45-basis-points-215106822.html)**: 대표 지수 ETF인 SPY와 저비용 ETF 대안 간의 장기 운용 수수료 격차가 누적 복리 수익률에 미치는 영향에 대한 장기 투자자들의 분석이 부각되었습니다.
"""

    report_file.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"Report successfully saved: {report_file}")


if __name__ == "__main__":
    main()
