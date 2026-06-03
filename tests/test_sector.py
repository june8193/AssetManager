import pytest
import datetime
from sqlalchemy.orm import Session
from src.backend.models import SectorETF, CustomSector, CustomSectorStock, HistoricalPrice
from src.backend.services.sector_service import SectorService

@pytest.fixture
def sector_service(db_session: Session):
    """SectorService 객체를 생성하여 반환하는 Fixture입니다.
    
    Args:
        db_session (Session): 테스트용 데이터베이스 세션
        
    Returns:
        SectorService: 섹터 서비스 인스턴스
    """
    return SectorService(db_session)

@pytest.mark.asyncio
async def test_manage_sector_etf(sector_service: SectorService, db_session: Session):
    """대표 ETF 추가, 조회, 삭제 기능을 테스트합니다."""
    # 1. ETF 추가 테스트
    # Mock price_service.get_stock_name이 동작한다고 가정하고 추가
    # 실제 API 호출을 방지하기 위해 가짜 메서드 래핑 또는 mock 사용 필요할 수 있음
    # 여기서는 직접 추가 로직을 호출
    # 단일 종목 추가
    etf = await sector_service.add_sector_etf(ticker="069500", name="KODEX 200", country="KR")
    assert etf.ticker == "069500"
    assert etf.name == "KODEX 200"
    assert etf.country == "KR"

    # 2. 목록 조회 테스트
    etfs = await sector_service.get_sector_etfs(country="KR")
    assert len(etfs) == 1
    assert etfs[0].ticker == "069500"

    # 3. 삭제 테스트
    success = await sector_service.delete_sector_etf(ticker="069500")
    assert success is True
    
    etfs_after = await sector_service.get_sector_etfs(country="KR")
    assert len(etfs_after) == 0

@pytest.mark.asyncio
async def test_manage_custom_sector(sector_service: SectorService, db_session: Session):
    """커스텀 섹터의 생성, 종목 추가/삭제, 섹터 삭제 기능을 테스트합니다."""
    # 1. 섹터 생성
    sector = await sector_service.create_custom_sector(name="반도체", country="KR")
    assert sector.name == "반도체"
    assert sector.country == "KR"

    # 2. 섹터에 종목 추가
    # 삼성전자(005930) 추가 (Mock API를 통과해 발행주식수를 가져왔다고 가정하기 위해 mock 혹은 테스트 파라미터 전달)
    stock = await sector_service.add_stock_to_sector(
        sector_id=sector.id,
        stock_code="005930",
        stock_name="삼성전자",
        shares_outstanding=50000000.0 # 발행주식수 임의 입력 가능하게도 설계
    )
    assert stock.stock_code == "005930"
    assert stock.shares_outstanding == 50000000.0

    # 3. 섹터 목록 및 하위 종목 조회
    sectors = await sector_service.get_custom_sectors(country="KR")
    assert len(sectors) == 1
    assert sectors[0].name == "반도체"
    assert len(sectors[0].stocks) == 1
    assert sectors[0].stocks[0].stock_code == "005930"

    # 4. 종목 삭제 테스트
    deleted = await sector_service.delete_stock_from_sector(sector_id=sector.id, stock_code="005930")
    assert deleted is True
    
    sectors_after = await sector_service.get_custom_sectors(country="KR")
    assert len(sectors_after[0].stocks) == 0

    # 5. 섹터 삭제 테스트
    sector_deleted = await sector_service.delete_custom_sector(sector_id=sector.id)
    assert sector_deleted is True
    
    sectors_all = await sector_service.get_custom_sectors(country="KR")
    assert len(sectors_all) == 0

@pytest.mark.asyncio
async def test_calculate_weighted_returns(sector_service: SectorService, db_session: Session):
    """시가총액 가중 방식으로 섹터 수익률이 올바르게 산출되는지 테스트합니다.
    
    시나리오:
      - 종목 A: 발행주식수 10주. 주가 100원 -> 110원 (+10% 상승)
      - 종목 B: 발행주식수 5주. 주가 200원 -> 180원 (-10% 하락)
      - 시작 합산 시가총액: 100 * 10 + 200 * 5 = 2000 원
      - 종료 합산 시가총액: 110 * 10 + 180 * 5 = 2000 원
      - 예상 가중 수익률: 0.0 %
    """
    # 1. 테스트 기초 데이터 적재
    sector = await sector_service.create_custom_sector(name="테스트섹터", country="KR")
    await sector_service.add_stock_to_sector(
        sector_id=sector.id,
        stock_code="A",
        stock_name="종목A",
        shares_outstanding=10.0
    )
    await sector_service.add_stock_to_sector(
        sector_id=sector.id,
        stock_code="B",
        stock_name="종목B",
        shares_outstanding=5.0
    )

    # 2. HistoricalPrice 가짜 가격 적재
    start_date = datetime.date(2026, 6, 1)
    end_date = datetime.date(2026, 6, 2)
    
    prices = [
        # 6월 1일 주가
        HistoricalPrice(ticker="A", price_date=start_date, close_price=100.0),
        HistoricalPrice(ticker="B", price_date=start_date, close_price=200.0),
        # 6월 2일 주가
        HistoricalPrice(ticker="A", price_date=end_date, close_price=110.0),
        HistoricalPrice(ticker="B", price_date=end_date, close_price=180.0),
        # 비교용 주요 지수 (KOSPI 대용)
        HistoricalPrice(ticker="^KS11", price_date=start_date, close_price=2000.0),
        HistoricalPrice(ticker="^KS11", price_date=end_date, close_price=2100.0) # KOSPI 5% 상승
    ]
    db_session.add_all(prices)
    db_session.commit()

    # 3. 대시보드 및 수익률 조회
    # compare_index = "^KS11" (KOSPI)
    dashboard_data = await sector_service.get_sector_dashboard_data(
        country="KR",
        period="Custom",
        compare_index="^KS11",
        start_date=start_date,
        end_date=end_date
    )
    
    # 4. 수익률 및 알파 차이 검증
    custom_sectors = dashboard_data.get("custom_sectors", [])
    assert len(custom_sectors) == 1
    
    test_sec = custom_sectors[0]
    assert test_sec["name"] == "테스트섹터"
    # 시작 시총 2000원 -> 종료 시총 2000원이므로 가중 수익률은 0.0이어야 함
    assert test_sec["return_rate"] == 0.0
    
    # 비교 지수(^KS11)는 2000 -> 2100 (+5.0%) 이므로, 
    # 알파(초과 수익률) = 테스트섹터 수익률(0.0) - 지수 수익률(5.0) = -5.0%
    assert test_sec["alpha"] == -5.0
    assert test_sec["judgment"] == "시장 하회"


@pytest.mark.asyncio
async def test_update_custom_sector_name(sector_service: SectorService, db_session: Session):
    """커스텀 섹터의 이름을 변경하는 기능을 테스트합니다."""
    # 1. 섹터 생성
    sector = await sector_service.create_custom_sector(name="반도체", country="KR")
    
    # 2. 이름 변경 실행
    updated = await sector_service.update_custom_sector(sector_id=sector.id, name="반도체 대장")
    assert updated is not None
    assert updated.name == "반도체 대장"
    
    # 3. DB 재조회하여 검증
    sectors = await sector_service.get_custom_sectors(country="KR")
    assert len(sectors) == 1
    assert sectors[0].name == "반도체 대장"


@pytest.mark.asyncio
async def test_watchlist_returns_in_dashboard(sector_service: SectorService, db_session: Session):
    """대시보드 조회 시 관심종목(Watchlist)의 단순 수익률 및 알파가 올바르게 포함되어 연산되는지 검증합니다."""
    # 1. 관심종목 데이터 직접 적재
    from src.backend.models import Watchlist
    item = Watchlist(stock_code="005930", stock_name="삼성전자", country="KR")
    db_session.add(item)
    db_session.commit()
    
    # 2. 역사적 가격 데이터 적재
    start_date = datetime.date(2026, 6, 1)
    end_date = datetime.date(2026, 6, 2)
    
    prices = [
        # 삼성전자 주가 (10% 상승)
        HistoricalPrice(ticker="005930", price_date=start_date, close_price=50000.0),
        HistoricalPrice(ticker="005930", price_date=end_date, close_price=55000.0),
        # 비교 지수 KOSPI (5% 상승)
        HistoricalPrice(ticker="^KS11", price_date=start_date, close_price=2000.0),
        HistoricalPrice(ticker="^KS11", price_date=end_date, close_price=2100.0)
    ]
    db_session.add_all(prices)
    db_session.commit()
    
    # 3. 대시보드 API 서비스 호출
    dashboard_data = await sector_service.get_sector_dashboard_data(
        country="KR",
        period="Custom",
        compare_index="^KS11",
        start_date=start_date,
        end_date=end_date
    )
    
    # 4. 관심종목 반환 데이터 검증
    watchlist_data = dashboard_data.get("watchlist", [])
    assert len(watchlist_data) == 1
    
    stock_res = watchlist_data[0]
    assert stock_res["ticker"] == "005930"
    assert stock_res["name"] == "삼성전자"
    assert stock_res["return_rate"] == 10.0 # 50000 -> 55000 (+10.0%)
    assert stock_res["alpha"] == 5.0 # 10.0 - 5.0 = 5.0%
    assert stock_res["judgment"] == "시장 상회"

