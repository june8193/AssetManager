import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# src 디렉토리를 path에 추가하여 backend 모듈을 로드할 수 있도록 합니다.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.database import SessionLocal
from src.backend.services.dashboard_service import DashboardService
from src.backend.services.benchmark_service import BenchmarkService

def main():
    db = SessionLocal()
    try:
        service = DashboardService(db)
        
        # 1. 연도별 통계
        yearly_stats = service.get_yearly_stats()
        print("=== 연도별 통계 ===")
        for stat in yearly_stats:
            print(f"연도: {stat['year']}")
            print(f"  기말자산 (assets): {stat['assets']:,.2f}원")
            print(f"  연간입금 (contribution): {stat['contribution']:,.2f}원")
            print(f"  연간수익 (profit): {stat['profit']:,.2f}원")
            print(f"  연간수익률 (roi): {stat['roi']}%")
            print(f"  증감 (increase): {stat['increase']:,.2f}원")
            print("-" * 30)

        # 2. 대시보드 요약
        # 비동기 함수 get_dashboard_summary 호출을 위해 asyncio 이벤트 루프 실행
        import asyncio
        summary = asyncio.run(service.get_dashboard_summary(force_update=False))
        
        print("\n=== 대시보드 요약 ===")
        print(f"총자산 (total_valuation_krw): {summary['total_valuation_krw']:,.2f}원")
        print(f"총입금 (total_contribution): {summary['total_contribution']:,.2f}원")
        print(f"최초 기초 자산 (initial_base_asset): {summary['initial_base_asset']:,.2f}원")
        print(f"누적 수익금 (total_profit): {summary['total_profit']:,.2f}원")
        print(f"누적 수익률 (cumulative_roi): {summary['cumulative_roi']}%")
        print(f"원금 비율 (contribution_ratio): {summary['contribution_ratio']}%")
        print(f"수익 비율 (profit_ratio): {summary['profit_ratio']}%")

        # 3. 성과비교 대시보드 (2026년도)
        # 2026년 1월 1일부터 오늘까지
        bench_service = BenchmarkService(db)
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date.today()
        tickers = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]
        
        bench_data = asyncio.run(bench_service.calculate_cumulative_returns(start_date, end_date, tickers))
        print("\n=== 2026년 성과비교 대시보드 ===")
        # 포트폴리오 수익률 리스트의 마지막 값 확인
        datasets = bench_data.get("datasets", [])
        if datasets:
            portfolio_dataset = datasets[0]
            print(f"라벨: {portfolio_dataset['label']}")
            if portfolio_dataset['data']:
                print(f"2026년 누적 수익률: {portfolio_dataset['data'][-1]}%")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
