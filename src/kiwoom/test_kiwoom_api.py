"""키움증권 Open API (REST) 테스트 스크립트.

secrets.json에 저장된 인증 정보를 사용하여
키움증권 REST API의 주요 기능을 테스트합니다.

사용법:
    python -m src.kiwoom.test_kiwoom_api
"""

import json
import sys

from src.kiwoom.api import (
    get_access_token,
    get_kiwoom_accounts,
    get_stock_basic_info,
    MOCK_BASE_URL,
)


def test_token_issuance(app_key: str, secret_key: str, base_url: str = MOCK_BASE_URL) -> str | None:
    """접근 토큰 발급을 테스트합니다.

    Args:
        app_key: 키움증권 앱 키.
        secret_key: 키움증권 시크릿 키.
        base_url: API 도메인 URL.

    Returns:
        발급된 토큰 문자열. 실패 시 None.
    """
    print("  ▶ 접근 토큰 발급 테스트 (au10001)...")
    token = get_access_token(app_key, secret_key, base_url)

    if token:
        print(f"  ✅ 토큰 발급 성공: {token[:15]}...")
    else:
        print("  ❌ 토큰 발급 실패")

    return token


def test_stock_info(token: str, stk_cd: str = "005930", base_url: str = MOCK_BASE_URL) -> dict | None:
    """주식 기본 정보 조회를 테스트합니다.

    Args:
        token: 접근 토큰.
        stk_cd: 종목 코드. 기본값은 삼성전자(005930).
        base_url: API 도메인 URL.

    Returns:
        종목 정보 딕셔너리. 실패 시 None.
    """
    print(f"  ▶ 종목 기본 정보 조회 테스트 (ka10001) - 종목코드: {stk_cd}...")
    info = get_stock_basic_info(token, stk_cd, base_url)

    if info and info.get("return_code") == 0:
        stk_nm = info.get("stk_nm", "알 수 없음")
        cur_prc = info.get("cur_prc", "N/A")
        print(f"  ✅ 조회 성공: {stk_nm} / 현재가: {cur_prc}원")
        print(f"  📋 전체 응답:\n{json.dumps(info, indent=4, ensure_ascii=False)}")
    else:
        msg = info.get("return_msg") if info else "응답 없음"
        print(f"  ❌ 종목 조회 실패: {msg}")

    return info


def run_all_tests() -> None:
    """secrets.json의 모든 키움증권 계좌에 대해 API 테스트를 실행합니다."""
    print("=" * 60)
    print("  키움증권 Open API 테스트")
    print("=" * 60)

    # secrets.json에서 키움증권 계좌 정보 로드
    try:
        accounts = get_kiwoom_accounts()
    except FileNotFoundError as e:
        print(f"\n❌ {e}")
        sys.exit(1)

    if not accounts:
        print("\n❌ secrets.json에 키움증권 계좌 정보가 없습니다.")
        sys.exit(1)

    print(f"\n총 {len(accounts)}개의 키움증권 계좌를 발견했습니다.\n")

    for i, account in enumerate(accounts, start=1):
        account_num = account["account"]
        app_key = account["app_key"]
        secret_key = account["secret_key"]

        print(f"─── 계좌 {i}: {account_num} ───")

        # 1. 토큰 발급 테스트
        token = test_token_issuance(app_key, secret_key)

        if not token:
            print(f"  ⏩ 토큰 발급 실패로 계좌 {account_num}의 나머지 테스트를 건너뜁니다.\n")
            continue

        # 2. 종목 기본 정보 조회 테스트 (삼성전자)
        test_stock_info(token, "005930")

        print()

    print("=" * 60)
    print("  테스트 완료")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
