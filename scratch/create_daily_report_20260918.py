# -*- coding: utf-8 -*-
"""2026-09-18 국내 시장 일일 지수 현황 보고서 파일 생성 스크립트."""

import subprocess
import sys
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
    report_dir = storage_dir / "reports" / "korea_market" / "daily"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_file = report_dir / "Korea_market_daily_report_20260918.md"

    content = f"""# 🇰🇷 국내 시장 일일 지수 현황 보고서 (2026-09-18)

## 📊 주요 지수 마감 현황
• KOSPI: 6,894.23 (+2.66%, +178.82pt)
• KOSDAQ: 827.12 (+0.60%, +4.94pt)

## 📰 시장 주요 뉴스 및 시황 요약

### 1. 외국인 8거래일 만의 순매수 복귀 및 반도체 투톱 급등에 코스피 2.66% 급등 (6,890선 탈환)
• 코스피 지수는 전 거래일 대비 178.82pt (+2.66%) 급등한 6,894.23에 마감하며 단숨에 6,890선을 회복했습니다.
• 장 초반 2.54% 오른 6,885.70으로 출발한 지수는 장중 6,914.08까지 치솟으며 6,900선을 넘어서기도 했습니다.
• 미국 연방준비제도(Fed)와 일본은행(BOJ)의 기준금리 인상 등 글로벌 긴축 악재가 시장에 이미 선반영되었다는 인식이 확산되고, 간밤 뉴욕증시 강세가 투자심리를 크게 개선했습니다.
• 수급 측면에서는 외국인이 8거래일 만에 순매수(+4,388억 원)로 전환했으며, 기관 역시 1조 5,000억 원 이상의 대규모 순매수를 기록하며 외국인과 기관의 강력한 쌍끌이 매수세가 지수 반등을 견인했습니다.
• 종목별로는 삼성전자(+3.37%)와 SK하이닉스(+6.42%) 등 반도체 대표주가 급등하며 지수 상승을 주도한 반면, KB금융(-2.40%), 신한지주(-2.82%) 등 금융/은행주는 약세를 기록했습니다.
• 관련 기사:
  - [코스피, 외국인 '사자'에 2%대 상승 마감](https://www.sentv.co.kr/article/view/sentv202609180193)
  - [외국인, 8거래일만에 '사자'…코스피, 2.66% 상승 마감](https://n.news.naver.com/mnews/article/055/0001389444?sid=101)
  - [반도체주가 견인한 코스피 상승... 외국인도 순매수 전환](https://n.news.naver.com/mnews/article/022/0004160189?sid=101)
  - [美·日 금리 인상 악재 “이미 반영했다”…외인 복귀에 코스피 2.6% 상승...](https://n.news.naver.com/mnews/article/243/0000103271?sid=101)

### 2. 코스닥, 개인·기관 동반 매수세에 4거래일 연속 상승 (+0.60%)
• 코스닥 지수는 전 거래일 대비 4.94pt (+0.60%) 상승한 827.12에 거래를 마치며 4거래일 연속 상승세를 이어갔습니다.
• 지수는 전장 대비 1.28% 오른 832.72로 출발해 장중 833.57까지 상승폭을 키웠으나, 이후 외국인 매도 우위 속에 상승폭을 다소 반납했습니다.
• 매매 주체별로는 개인이 122억 원, 기관이 217억 원을 각각 순매수한 반면 외국인은 428억 원 순매도를 기록했습니다.
• 관련 기사:
  - [코스피 2.66% 급등해 6,890선 회복-외국인 8거래일 만에 순매수](https://www.mediafine.co.kr/news/articleView.html?idxno=90166)
  - [코스피, 2.66% 상승 마감…외국인, 8거래일 만에 ‘사자’](https://n.news.naver.com/mnews/article/056/0012260180?sid=101)
  - [삼성전자·SK하이닉스 급등…주식 강세 마감](http://www.kjdaily.com/article.php?aid=1789717264687198227)

### 3. 정부 민생 안정 대책 및 글로벌 아시아 증시 동향
• 정부는 추석 연휴를 앞두고 고속도로 주유소 기름값 인하 등 물가 및 민생 안정 대책을 적극 추진 중이며, 대외 불확실성 속에서도 견조한 거시경제 성장세를 지속 유지하겠다는 의지를 표명했습니다.
• 글로벌 금융시장에서는 미·일 중앙은행의 금리 인상 결정에도 불구하고 불확실성 해소 및 AI·반도체 섹터 중심의 위험자산 선호 심리가 부활하며 일본 닛케이(+1.4%), 대만 증시 등 아시아 주요 증시가 동반 강세를 나타냈습니다.
• 관련 기사:
  - [구윤철 부총리 "추석연휴 고속도로 기름값 ℓ당 100원 인하"… 유류세 인...](http://www.sisunnews.co.kr/news/articleView.html?idxno=246327)
  - [아시아증시, 日 금리인상에도 상승⋯닛케이 1.4%↑](https://www.etoday.co.kr/news/view/2627387)

📁 **파일 저장 경로**:
- MD: `{report_file}`
"""

    report_file.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"Report successfully saved: {report_file}")


if __name__ == "__main__":
    main()
