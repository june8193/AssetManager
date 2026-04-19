"""키움증권 Open API (REST) 클라이언트 모듈.

키움증권 REST API와 통신하기 위한 유틸리티 함수들을 제공합니다.
모의투자 및 실전투자 환경 모두 지원합니다.
"""

import json
import os
from pathlib import Path

import requests

# 프로젝트 루트 경로 (src/kiwoom/api.py 기준 2단계 상위)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# API 도메인
MOCK_BASE_URL = "https://mockapi.kiwoom.com"  # 모의투자
REAL_BASE_URL = "https://api.kiwoom.com"      # 실전투자


def load_secrets(secrets_path: str | Path | None = None) -> dict:
    """secrets.json 파일에서 인증 정보를 로드합니다.

    Args:
        secrets_path: secrets.json 파일 경로.
            None이면 프로젝트 루트의 secrets.json을 사용합니다.

    Returns:
        secrets.json의 전체 내용을 딕셔너리로 반환합니다.

    Raises:
        FileNotFoundError: secrets.json 파일이 존재하지 않을 때 발생합니다.
        json.JSONDecodeError: JSON 파싱에 실패했을 때 발생합니다.
    """
    if secrets_path is None:
        secrets_path = _PROJECT_ROOT / "secrets.json"

    secrets_path = Path(secrets_path)

    if not secrets_path.exists():
        raise FileNotFoundError(f"secrets.json 파일을 찾을 수 없습니다: {secrets_path}")

    with open(secrets_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_kiwoom_accounts(secrets_path: str | Path | None = None) -> list[dict]:
    """secrets.json에서 키움증권 계좌 목록을 가져옵니다.

    Args:
        secrets_path: secrets.json 파일 경로. None이면 기본 경로를 사용합니다.

    Returns:
        키움증권 계좌 정보 딕셔너리의 리스트.
        각 딕셔너리에는 broker, account, app_key, secret_key가 포함됩니다.
    """
    secrets = load_secrets(secrets_path)
    accounts = secrets.get("accounts", [])
    return [acc for acc in accounts if acc.get("broker") == "키움증권"]


def get_access_token(
    app_key: str,
    secret_key: str,
    base_url: str = MOCK_BASE_URL,
) -> str | None:
    """키움증권 접근 토큰을 발급받습니다. (API ID: au10001)

    Args:
        app_key: 키움증권 Open API에서 발급받은 앱 키.
        secret_key: 키움증권 Open API에서 발급받은 시크릿 키.
        base_url: API 도메인 URL. 기본값은 모의투자 도메인입니다.

    Returns:
        발급된 접근 토큰 문자열. 실패 시 None을 반환합니다.
    """
    url = f"{base_url}/oauth2/token"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
    }
    data = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "secretkey": secret_key,
    }

    response = requests.post(url, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        result = response.json()
        if result.get("return_code") == 0:
            return result.get("token")
        else:
            print(f"[오류] 토큰 발급 실패: {result.get('return_msg')}")
    else:
        print(f"[오류] HTTP 통신 에러: {response.status_code}")

    return None


def get_stock_basic_info(
    token: str,
    stk_cd: str,
    base_url: str = MOCK_BASE_URL,
) -> dict | None:
    """주식 기본 정보를 조회합니다. (API ID: ka10001)

    Args:
        token: 접근 토큰 문자열.
        stk_cd: 종목 코드 (예: '005930' - 삼성전자).
        base_url: API 도메인 URL. 기본값은 모의투자 도메인입니다.

    Returns:
        종목 기본 정보가 담긴 딕셔너리. 실패 시 None을 반환합니다.
    """
    url = f"{base_url}/api/dostk/stkinfo"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": "ka10001",
        "authorization": f"Bearer {token}",
    }
    data = {
        "stk_cd": stk_cd,
    }

    response = requests.post(url, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        return response.json()
    else:
        print(f"[오류] 종목 조회 실패: {response.status_code}")
        return None
