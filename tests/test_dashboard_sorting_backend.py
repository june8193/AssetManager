import pytest
import datetime
from unittest.mock import AsyncMock, patch
from src.backend.models import User, Account, Asset, Transaction, ExchangeRate
from src.backend.services.dashboard_service import DashboardService

@pytest.mark.asyncio
async def test_get_dashboard_summary_includes_category_info(db_session):
    """대시보드 요약 API 응답에 자산의 카테고리 정보가 포함되는지 검증합니다."""
    # 1. 테스트 데이터 설정
    user = User(name="Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="Test Account", provider="Test Broker", is_active=True)
    db_session.add(account)
    db_session.commit()

    asset = Asset(
        ticker="AAPL", 
        name="애플", 
        major_category="주식", 
        sub_category="코어(지수)", 
        country="US"
    )
    db_session.add(asset)
    db_session.commit()

    # 트랜잭션 추가 (보유량 생성)
    tx = Transaction(
        account_id=account.id,
        asset_id=asset.id,
        transaction_date=datetime.date.today(),
        type="BUY",
        quantity=10.0,
        price=150.0,
        total_amount=1500.0,
        currency="USD"
    )
    db_session.add(tx)
    
    # 환율 정보 추가
    ex_rate = ExchangeRate(
        date=datetime.date.today(),
        currency="USD",
        rate=1300.0
    )
    db_session.add(ex_rate)
    db_session.commit()

    # 2. 서비스 호출 (가격을 170.0으로 모킹)
    with patch("src.backend.services.dashboard_service.KiwoomAPI"), \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager"):
        
        service = DashboardService(db_session)
        
        # get_current_prices 모킹
        service.get_current_prices = AsyncMock(return_value={"AAPL": 170.0})
        
        summary = await service.get_dashboard_summary()
        
        # 3. 검증
        assert "accounts" in summary
        assert len(summary["accounts"]) > 0
        
        acc_summary = summary["accounts"][0]
        assert "assets" in acc_summary
        assert len(acc_summary["assets"]) > 0
        
        asset_info = acc_summary["assets"][0]
        assert asset_info["ticker"] == "AAPL"
        assert asset_info["category"] == "주식"
        assert asset_info["sub_category"] == "코어(지수)"
        assert asset_info["valuation_krw"] == 10.0 * 170.0 * 1300.0


@pytest.mark.asyncio
async def test_get_dashboard_summary_assets_sorted_by_valuation_desc(db_session):
    """대시보드 요약 API 응답에서 각 계좌의 assets 리스트가 평가금액(KRW) 내림차순으로 정렬되는지 검증합니다."""
    user = User(name="Sort Test User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="종합계좌", provider="키움증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 자산 생성: KRW, USD, 종목1(저가), 종목2(고가)
    krw_asset = Asset(ticker="KRW", name="원화예수금", major_category="현금", sub_category="원화예수금", country="KR")
    usd_asset = Asset(ticker="USD", name="외화예수금", major_category="현금", sub_category="달러예수금", country="US")
    stock_a = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="코어(지수)", country="KR")
    stock_b = Asset(ticker="TSLA", name="테슬라", major_category="주식", sub_category="알파(성장)", country="US")
    db_session.add_all([krw_asset, usd_asset, stock_a, stock_b])
    db_session.commit()

    today = datetime.date.today()
    # 1) 원화 예수금 1000만 원 입금 -> 삼성전자 70만 원 매수 -> 잔여 930만 원
    # 2) USD 예수금 $10,000 입금 -> 테슬라 $4,000 매수 -> 잔여 $6,000 (환율 1,300원 -> 780만 원)
    # 3) 테슬라 10주 @ $400 (환율 1,300원 -> 520만 원)
    # 4) 삼성전자 10주 @ 70,000원 -> 70만 원
    # 기대 평가금액 순: 원화예수금(930만) > 외화예수금(780만) > 테슬라(520만) > 삼성전자(70만)
    tx_deposit_krw = Transaction(account_id=account.id, asset_id=krw_asset.id, transaction_date=today, type="DEPOSIT", quantity=10000000.0, price=1.0, total_amount=10000000.0, currency="KRW")
    tx_deposit_usd = Transaction(account_id=account.id, asset_id=usd_asset.id, transaction_date=today, type="DEPOSIT", quantity=10000.0, price=1.0, total_amount=10000.0, currency="USD")
    tx_buy_a = Transaction(account_id=account.id, asset_id=stock_a.id, transaction_date=today, type="BUY", quantity=10.0, price=70000.0, total_amount=700000.0, currency="KRW")
    tx_buy_b = Transaction(account_id=account.id, asset_id=stock_b.id, transaction_date=today, type="BUY", quantity=10.0, price=400.0, total_amount=4000.0, currency="USD")
    db_session.add_all([tx_deposit_krw, tx_deposit_usd, tx_buy_a, tx_buy_b])

    ex_rate = ExchangeRate(date=today, currency="USD", rate=1300.0)
    db_session.add(ex_rate)
    db_session.commit()

    with patch("src.backend.services.dashboard_service.KiwoomAPI"), \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager"):
        service = DashboardService(db_session)
        service.get_current_prices = AsyncMock(return_value={
            "KRW": 1.0,
            "USD": 1.0,
            "005930": 70000.0,
            "TSLA": 400.0
        })

        summary = await service.get_dashboard_summary()

        acc = summary["accounts"][0]
        asset_names = [a["name"] for a in acc["assets"]]
        valuations = [a["valuation_krw"] for a in acc["assets"]]

        assert asset_names == ["원화예수금", "외화예수금", "테슬라", "삼성전자"]
        assert valuations == [9300000.0, 7800000.0, 5200000.0, 700000.0]


@pytest.mark.asyncio
async def test_get_dashboard_summary_assets_tiebreaker_by_name_asc(db_session):
    """대시보드 요약 API 응답에서 평가금액이 동일한 자산 간에 종목명 가나다/알파벳 오름차순으로 정렬되는지 검증합니다."""
    user = User(name="Tiebreaker User")
    db_session.add(user)
    db_session.commit()

    account = Account(user_id=user.id, name="동일금액계좌", provider="토스증권", is_active=True)
    db_session.add(account)
    db_session.commit()

    # 동일 평가금액(100만 원) 3종목: 카카오, 네이버, 삼성전자
    stock_k = Asset(ticker="035720", name="카카오", major_category="주식", sub_category="알파(성장)", country="KR")
    stock_n = Asset(ticker="035420", name="네이버", major_category="주식", sub_category="알파(성장)", country="KR")
    stock_s = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="코어(지수)", country="KR")
    # 0원 종목 2종목: 하이브, 알파벳
    stock_h = Asset(ticker="352820", name="하이브", major_category="주식", sub_category="알파(성장)", country="KR")
    stock_g = Asset(ticker="GOOGL", name="알파벳", major_category="주식", sub_category="코어(지수)", country="US")
    db_session.add_all([stock_k, stock_n, stock_s, stock_h, stock_g])
    db_session.commit()

    today = datetime.date.today()
    tx_k = Transaction(account_id=account.id, asset_id=stock_k.id, transaction_date=today, type="BUY", quantity=10.0, price=100000.0, total_amount=1000000.0, currency="KRW")
    tx_n = Transaction(account_id=account.id, asset_id=stock_n.id, transaction_date=today, type="BUY", quantity=10.0, price=100000.0, total_amount=1000000.0, currency="KRW")
    tx_s = Transaction(account_id=account.id, asset_id=stock_s.id, transaction_date=today, type="BUY", quantity=10.0, price=100000.0, total_amount=1000000.0, currency="KRW")
    tx_h = Transaction(account_id=account.id, asset_id=stock_h.id, transaction_date=today, type="BUY", quantity=10.0, price=0.0, total_amount=0.0, currency="KRW")
    tx_g = Transaction(account_id=account.id, asset_id=stock_g.id, transaction_date=today, type="BUY", quantity=10.0, price=0.0, total_amount=0.0, currency="USD")
    db_session.add_all([tx_k, tx_n, tx_s, tx_h, tx_g])

    ex_rate = ExchangeRate(date=today, currency="USD", rate=1300.0)
    db_session.add(ex_rate)
    db_session.commit()

    with patch("src.backend.services.dashboard_service.KiwoomAPI"), \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager"):
        service = DashboardService(db_session)
        service.get_current_prices = AsyncMock(return_value={
            "035720": 100000.0,
            "035420": 100000.0,
            "005930": 100000.0,
            "352820": 0.0,
            "GOOGL": 0.0
        })

        summary = await service.get_dashboard_summary()

        acc = summary["accounts"][0]
        asset_names = [a["name"] for a in acc["assets"]]
        valuations = [a["valuation_krw"] for a in acc["assets"]]

        # 100만원 그룹 (가나다순): 네이버 -> 삼성전자 -> 카카오
        # 0원 그룹 (가나다순): 알파벳 -> 하이브
        assert asset_names == ["네이버", "삼성전자", "카카오", "알파벳", "하이브"]
        assert valuations == [1000000.0, 1000000.0, 1000000.0, 0.0, 0.0]


@pytest.mark.asyncio
async def test_get_dashboard_summary_multi_accounts_sorted_independently(db_session):
    """대시보드 요약 API 응답에서 여러 계좌가 존재할 때 각 계좌의 assets가 독립적으로 정렬되는지 검증합니다."""
    user = User(name="Multi Acc User")
    db_session.add(user)
    db_session.commit()

    acc1 = Account(user_id=user.id, name="계좌1", provider="증권사A", is_active=True)
    acc2 = Account(user_id=user.id, name="계좌2", provider="증권사B", is_active=True)
    db_session.add_all([acc1, acc2])
    db_session.commit()

    stock_a = Asset(ticker="005930", name="삼성전자", major_category="주식", sub_category="코어(지수)", country="KR")
    stock_b = Asset(ticker="000660", name="SK하이닉스", major_category="주식", sub_category="알파(성장)", country="KR")
    stock_c = Asset(ticker="035420", name="NAVER", major_category="주식", sub_category="알파(성장)", country="KR")
    db_session.add_all([stock_a, stock_b, stock_c])
    db_session.commit()

    today = datetime.date.today()
    # 계좌1: 삼성전자 100주(700만원) + NAVER 10주(200만원) -> 삼성전자 > NAVER
    # 계좌2: SK하이닉스 10주(150만원) + NAVER 20주(400만원) -> NAVER > SK하이닉스
    tx1_a = Transaction(account_id=acc1.id, asset_id=stock_a.id, transaction_date=today, type="BUY", quantity=100.0, price=70000.0, total_amount=7000000.0, currency="KRW")
    tx1_c = Transaction(account_id=acc1.id, asset_id=stock_c.id, transaction_date=today, type="BUY", quantity=10.0, price=200000.0, total_amount=2000000.0, currency="KRW")
    tx2_b = Transaction(account_id=acc2.id, asset_id=stock_b.id, transaction_date=today, type="BUY", quantity=10.0, price=150000.0, total_amount=1500000.0, currency="KRW")
    tx2_c = Transaction(account_id=acc2.id, asset_id=stock_c.id, transaction_date=today, type="BUY", quantity=20.0, price=200000.0, total_amount=4000000.0, currency="KRW")
    db_session.add_all([tx1_a, tx1_c, tx2_b, tx2_c])
    db_session.commit()

    with patch("src.backend.services.dashboard_service.KiwoomAPI"), \
         patch("src.backend.services.dashboard_service.KiwoomAuthManager"):
        service = DashboardService(db_session)
        service.get_current_prices = AsyncMock(return_value={
            "005930": 70000.0,
            "000660": 150000.0,
            "035420": 200000.0
        })

        summary = await service.get_dashboard_summary()

        acc_map = {a["name"]: a for a in summary["accounts"]}
        acc1_assets = [a["name"] for a in acc_map["계좌1"]["assets"]]
        acc2_assets = [a["name"] for a in acc_map["계좌2"]["assets"]]

        assert acc1_assets == ["삼성전자", "NAVER"]
        assert acc2_assets == ["NAVER", "SK하이닉스"]

