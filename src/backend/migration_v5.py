import datetime
from sqlalchemy.orm import Session
from .database import engine, Base
from .models import SectorETF, CustomSector, CustomSectorStock

def run_migration():
    """섹터 분석 기능을 위한 테이블 생성 및 초기 Seed 데이터를 입력하는 마이그레이션 함수입니다.
    
    1. sector_etfs, custom_sectors, custom_sector_stocks 테이블 생성
    2. 대표 ETF Seed 데이터 삽입 (한국 3개, 미국 4개)
    3. 샘플 커스텀 섹터 Seed 데이터 삽입 (한국 'IT/반도체', 미국 '빅테크')
    """
    print("[INFO] 마이그레이션 시작: 섹터 분석 테이블 생성 및 Seed 데이터 입력")
    
    # 1. 테이블 생성
    Base.metadata.create_all(bind=engine)
    print("  - 테이블 생성 완료 (sector_etfs, custom_sectors, custom_sector_stocks)")

    # 2. Seed 데이터 입력
    with Session(bind=engine) as session:
        try:
            # 2.1 대표 ETF 데이터
            seed_etfs = [
                # 한국 ETF
                {"ticker": "069500", "name": "KODEX 200", "country": "KR"},
                {"ticker": "091160", "name": "KODEX 반도체", "country": "KR"},
                {"ticker": "305540", "name": "TIGER 2차전지테마", "country": "KR"},
                # 미국 ETF
                {"ticker": "XLK", "name": "Technology Select Sector SPDR", "country": "US"},
                {"ticker": "XLF", "name": "Financial Select Sector SPDR", "country": "US"},
                {"ticker": "XLV", "name": "Health Care Select Sector SPDR", "country": "US"},
                {"ticker": "XLY", "name": "Consumer Discretionary Select Sector SPDR", "country": "US"}
            ]
            
            added_etf_count = 0
            for etf_data in seed_etfs:
                exists = session.query(SectorETF).filter(SectorETF.ticker == etf_data["ticker"]).first()
                if not exists:
                    etf = SectorETF(
                        ticker=etf_data["ticker"],
                        name=etf_data["name"],
                        country=etf_data["country"]
                    )
                    session.add(etf)
                    added_etf_count += 1
            
            # 2.2 샘플 커스텀 섹터 및 종목 데이터
            # 한국 샘플: IT/반도체
            kr_sector_name = "IT/반도체"
            exists_kr_sector = session.query(CustomSector).filter(
                CustomSector.name == kr_sector_name, 
                CustomSector.country == "KR"
            ).first()
            
            if not exists_kr_sector:
                kr_sector = CustomSector(name=kr_sector_name, country="KR")
                session.add(kr_sector)
                session.flush() # ID 획득을 위해 flush
                
                # 삼성전자, SK하이닉스 기본 종목 추가 (발행주식수는 API 검증값 기준)
                samsung = CustomSectorStock(
                    sector_id=kr_sector.id,
                    stock_code="005930",
                    stock_name="삼성전자",
                    shares_outstanding=58462790.0 # 58,462,790 주
                )
                hynix = CustomSectorStock(
                    sector_id=kr_sector.id,
                    stock_code="000660",
                    stock_name="SK하이닉스",
                    shares_outstanding=7127020.0 # 7,127,020 주
                )
                session.add_all([samsung, hynix])
                print(f"  - 한국 샘플 섹터 '{kr_sector_name}' 및 종목(삼성전자, SK하이닉스) 추가 완료")

            # 미국 샘플: 빅테크
            us_sector_name = "빅테크"
            exists_us_sector = session.query(CustomSector).filter(
                CustomSector.name == us_sector_name, 
                CustomSector.country == "US"
            ).first()
            
            if not exists_us_sector:
                us_sector = CustomSector(name=us_sector_name, country="US")
                session.add(us_sector)
                session.flush()
                
                # 엔비디아, 알파벳 기본 종목 추가
                nvda = CustomSectorStock(
                    sector_id=us_sector.id,
                    stock_code="NVDA",
                    stock_name="NVIDIA Corporation",
                    shares_outstanding=24221000000.0 # 24,221,000,000 주
                )
                googl = CustomSectorStock(
                    sector_id=us_sector.id,
                    stock_code="GOOGL",
                    stock_name="Alphabet Inc.",
                    shares_outstanding=5823665113.0 # 5.82B 주
                )
                session.add_all([nvda, googl])
                print(f"  - 미국 샘플 섹터 '{us_sector_name}' 및 종목(엔비디아, 알파벳) 추가 완료")

            session.commit()
            print(f"[SUCCESS] 마이그레이션 성공! (신규 대표 ETF {added_etf_count}개 추가됨)")
        except Exception as e:
            session.rollback()
            print(f"[ERROR] 마이그레이션 실패: {e}")
            raise e

if __name__ == "__main__":
    run_migration()
