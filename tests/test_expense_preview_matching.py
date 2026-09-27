# -*- coding: utf-8 -*-
"""명세서 업로드 미리보기 자동분류 매칭 엔진 통합 테스트 모듈입니다."""

from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.main import app
from src.backend.database import Base, get_db
from src.backend.models import PaymentMethod, ExpenseCategory, ExpenseRule


# 테스트용 인메모리 SQLite DB 설정
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    """테스트용 격리된 인메모리 DB 세션 fixture."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # 기본 결제수단 등록
    pm = PaymentMethod(
        owner="홍길동",
        institution="현대카드",
        alias="홍길동 현대카드",
        account_number="1234",
        is_active=True,
    )
    session.add(pm)

    # 카테고리 등록
    cat_food = ExpenseCategory(name="식비/카페", color="#FF6B6B", is_default=True)
    cat_shopping = ExpenseCategory(name="쇼핑", color="#4ECDC4", is_default=True)
    cat_finance = ExpenseCategory(name="금융/보험", color="#BB8FCE", is_default=True)
    session.add_all([cat_food, cat_shopping, cat_finance])
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """테스트용 FastAPI TestClient fixture."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def fixtures_dir() -> Path:
    """테스트 픽스처 디렉토리 경로."""
    return Path(__file__).parent / "fixtures" / "statements"


def test_preview_matching_single_rule_success(client, db_session):
    """가맹점에 단일 규칙이 매칭될 경우 category_id가 자동 주입되고 is_excluded는 False인지 검증합니다."""
    food_cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    pm = db_session.query(PaymentMethod).first()

    # '스타벅스' 규칙 등록
    rule = ExpenseRule(keyword="스타벅스", category_id=food_cat.id, is_excluded=False)
    db_session.add(rule)
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-10 12:00:00",
                "year_month": "2026-08",
                "merchant": "스타벅스 강남점",
                "amount": 5500.0,
                "original_type": "일시불",
                "memo": None,
            }
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 1
    assert txs[0]["merchant"] == "스타벅스 강남점"
    assert txs[0]["category_id"] == food_cat.id
    assert txs[0]["is_excluded"] is False


def test_preview_matching_case_insensitive(client, db_session):
    """대소문자 구분 없이(Case-Insensitive) 가맹점명과 키워드가 매칭되는지 검증합니다."""
    food_cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    pm = db_session.query(PaymentMethod).first()

    # 소문자 키워드 'starbucks' 등록
    rule = ExpenseRule(keyword="starbucks", category_id=food_cat.id, is_excluded=False)
    db_session.add(rule)
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-11 14:00:00",
                "year_month": "2026-08",
                "merchant": "STARBUCKS COFFEE KOREA",
                "amount": 6000.0,
                "original_type": "일시불",
                "memo": None,
            }
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert txs[0]["category_id"] == food_cat.id
    assert txs[0]["is_excluded"] is False


def test_preview_matching_longest_match_priority(client, db_session):
    """복수 규칙이 동시 일치하는 경우 더 긴(구체적인) 키워드를 가진 규칙이 최우선 매칭되는지 검증합니다."""
    food_cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    shopping_cat = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()
    pm = db_session.query(PaymentMethod).first()

    # '쿠팡' (쇼핑) 규칙 등록
    rule_short = ExpenseRule(keyword="쿠팡", category_id=shopping_cat.id, is_excluded=False)
    # '쿠팡이츠' (식비/카페) 규칙 등록 - 더 긴 키워드
    rule_long = ExpenseRule(keyword="쿠팡이츠", category_id=food_cat.id, is_excluded=False)
    db_session.add_all([rule_short, rule_long])
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-12 18:00:00",
                "year_month": "2026-08",
                "merchant": "쿠팡이츠_주문배달",
                "amount": 23000.0,
                "original_type": "일시불",
                "memo": None,
            },
            {
                "transaction_date": "2026-08-12 19:00:00",
                "year_month": "2026-08",
                "merchant": "(주)쿠팡_로켓와우",
                "amount": 4990.0,
                "original_type": "일시불",
                "memo": None,
            },
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 2

    # 쿠팡이츠는 더 긴 키워드인 rule_long(식비/카페) 매칭
    assert txs[0]["merchant"] == "쿠팡이츠_주문배달"
    assert txs[0]["category_id"] == food_cat.id
    assert txs[0]["is_excluded"] is False

    # 쿠팡은 rule_short(쇼핑) 매칭
    assert txs[1]["merchant"] == "(주)쿠팡_로켓와우"
    assert txs[1]["category_id"] == shopping_cat.id
    assert txs[1]["is_excluded"] is False


def test_preview_matching_excluded_rule(client, db_session):
    """매칭된 규칙이 is_excluded == True인 경우 is_excluded = True, category_id = None 주입을 검증합니다."""
    pm = db_session.query(PaymentMethod).first()

    # 통계 제외 규칙 등록
    rule = ExpenseRule(keyword="카드대금", category_id=None, is_excluded=True)
    db_session.add(rule)
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-25 10:00:00",
                "year_month": "2026-08",
                "merchant": "현대카드대금 결제",
                "amount": 350000.0,
                "original_type": "출금",
                "memo": None,
            }
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 1
    assert txs[0]["category_id"] is None
    assert txs[0]["is_excluded"] is True


def test_preview_matching_unmatched_maintains_defaults(client, db_session):
    """일치하는 규칙이 없는 경우 기본값 is_excluded = False, category_id = None을 유지하는지 검증합니다."""
    food_cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    pm = db_session.query(PaymentMethod).first()

    rule = ExpenseRule(keyword="스타벅스", category_id=food_cat.id, is_excluded=False)
    db_session.add(rule)
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-26 15:00:00",
                "year_month": "2026-08",
                "merchant": "동네알수없는미분류가게",
                "amount": 12000.0,
                "original_type": "일시불",
                "memo": None,
            }
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 1
    assert txs[0]["category_id"] is None
    assert txs[0]["is_excluded"] is False


def test_preview_matching_with_actual_statement_fixture(client, db_session, fixtures_dir):
    """실제 명세서 파일(현대카드 HTML)을 업로드하여 등록된 규칙들이 올바르게 자동 매칭되는지 E2E 검증합니다."""
    shopping_cat = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()
    finance_cat = db_session.query(ExpenseCategory).filter_by(name="금융/보험").first()
    pm = db_session.query(PaymentMethod).first()

    # 실제 파일에 포함된 '유니클로', '현대해상' 규칙 등록
    rule_shopping = ExpenseRule(keyword="유니클로", category_id=shopping_cat.id, is_excluded=False)
    rule_finance = ExpenseRule(keyword="현대해상", category_id=finance_cat.id, is_excluded=False)
    db_session.add_all([rule_shopping, rule_finance])
    db_session.commit()

    hc_file = fixtures_dir / "hyundaicard_2608.html"
    assert hc_file.exists(), f"픽스처 파일이 없습니다: {hc_file}"

    with open(hc_file, "rb") as f:
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("hyundaicard_2608.html", f, "text/html")},
            data={"password": "950811", "payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    data = response.json()
    txs = data["transactions"]
    assert len(txs) == 10

    # 유니클로 거래 확인
    uniqlo_txs = [tx for tx in txs if "유니클로" in tx["merchant"]]
    assert len(uniqlo_txs) > 0
    for tx in uniqlo_txs:
        assert tx["category_id"] == shopping_cat.id
        assert tx["is_excluded"] is False

    # 현대해상 거래 확인
    insurance_txs = [tx for tx in txs if "현대해상" in tx["merchant"]]
    assert len(insurance_txs) > 0
    for tx in insurance_txs:
        assert tx["category_id"] == finance_cat.id
        assert tx["is_excluded"] is False

    # 그 외 미등록 가맹점은 미분류 유지 확인
    other_txs = [tx for tx in txs if "유니클로" not in tx["merchant"] and "현대해상" not in tx["merchant"]]
    assert len(other_txs) > 0
    for tx in other_txs:
        assert tx["category_id"] is None
        assert tx["is_excluded"] is False


def test_match_expense_rule_unit_edge_cases():
    """match_expense_rule 헬퍼 함수의 엣지 케이스(None, 공백, 빈 규칙 등) 단위 동작을 검증합니다."""
    from src.backend.routers.expenses import match_expense_rule

    # 1. merchant가 None이거나 공백일 때
    assert match_expense_rule(None, []) == (None, False)
    assert match_expense_rule("", []) == (None, False)
    assert match_expense_rule("   ", []) == (None, False)

    # 2. 규칙 목록이 비어있을 때
    assert match_expense_rule("스타벅스 강남점", []) == (None, False)

    # 3. 키워드 매칭
    r1 = ExpenseRule(id=1, keyword="스타벅스", category_id=10, is_excluded=False)
    r2 = ExpenseRule(id=2, keyword="카드대금", category_id=None, is_excluded=True)
    rules = [r1, r2]

    assert match_expense_rule("  스타벅스  ", rules) == (10, False)
    assert match_expense_rule("신한카드대금 자동이체", rules) == (None, True)
    assert match_expense_rule("파리바게뜨", rules) == (None, False)


def test_preview_matching_empty_or_whitespace_merchant(client, db_session):
    """거래의 merchant가 비어있거나 공백인 경우에도 오류 없이 기본값이 유지되는지 검증합니다."""
    pm = db_session.query(PaymentMethod).first()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-10 12:00:00",
                "year_month": "2026-08",
                "merchant": "",
                "amount": 1000.0,
                "original_type": "일시불",
                "memo": None,
            },
            {
                "transaction_date": "2026-08-10 13:00:00",
                "year_month": "2026-08",
                "merchant": "   ",
                "amount": 2000.0,
                "original_type": "일시불",
                "memo": None,
            },
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 2
    assert txs[0]["category_id"] is None
    assert txs[0]["is_excluded"] is False
    assert txs[1]["category_id"] is None
    assert txs[1]["is_excluded"] is False


def test_preview_matching_same_length_rule_priority(client, db_session):
    """키워드 길이가 동일할 때 최신 생성된 규칙이 우선순위를 가지는지 검증합니다."""
    food_cat = db_session.query(ExpenseCategory).filter_by(name="식비/카페").first()
    shopping_cat = db_session.query(ExpenseCategory).filter_by(name="쇼핑").first()
    pm = db_session.query(PaymentMethod).first()

    # 동일한 길이(4글자)의 서로 다른 두 규칙이 동일 가맹점에 매칭 가능한 경우:
    # 예: 가맹점 "카카오선물하기"
    # rule 1: "선물하기" (길이 4) -> 식비
    # rule 2: "카카오선" (길이 4) -> 쇼핑 (나중에 생성됨)
    rule_first = ExpenseRule(keyword="선물하기", category_id=food_cat.id, is_excluded=False)
    db_session.add(rule_first)
    db_session.commit()

    rule_second = ExpenseRule(keyword="카카오선", category_id=shopping_cat.id, is_excluded=False)
    db_session.add(rule_second)
    db_session.commit()

    mock_parse_result = {
        "institution": "현대카드",
        "owner": "홍길동",
        "account_identifier": "1234",
        "year_month": "2026-08",
        "transactions": [
            {
                "transaction_date": "2026-08-15 12:00:00",
                "year_month": "2026-08",
                "merchant": "카카오선물하기 결제",
                "amount": 15000.0,
                "original_type": "일시불",
                "memo": None,
            }
        ],
    }

    with patch("src.backend.routers.expenses.ExpenseParserService.detect_institution", return_value="현대카드"), \
         patch("src.backend.routers.expenses.ExpenseParserService.parse", return_value=mock_parse_result):
        response = client.post(
            "/api/expenses/upload-preview",
            files={"file": ("test.html", b"<html>mock</html>", "text/html")},
            data={"payment_method_id": pm.id},
        )

    assert response.status_code == 200, response.text
    txs = response.json()["transactions"]
    assert len(txs) == 1
    # 나중에 등록된 rule_second (쇼핑) 매칭
    assert txs[0]["category_id"] == shopping_cat.id

