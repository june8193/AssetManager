import os
import json
import requests

class KiwoomAPI:
    """키움증권 Open API (REST) 연동 클래스

    이 클래스는 계정 정보를 관리하고, 토큰 발급 및 계좌 정보 조회 등
    기본적인 API 연동 기능을 제공합니다.
    """

    def __init__(self, settings_path="settings.json"):
        """KiwoomAPI 초기화

        Args:
            settings_path (str): 계정 정보가 담긴 settings.json 파일 경로.
        """
        self.settings = self._load_settings(settings_path)
        self.base_url = self.settings.get("base_url")
        if not self.base_url:
            raise ValueError(f"'{settings_path}'에 'base_url' 설정이 누락되었습니다.")

    def _load_settings(self, path):
        """settings.json 파일을 로드합니다.

        Args:
            path (str): 파일 경로.

        Returns:
            dict: 로드된 계정 정보.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"{path} 파일을 찾을 수 없습니다.")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_access_token(self, app_key, secret_key):
        """접근 토큰을 발급받습니다 (au10001).

        Args:
            app_key (str): 발급받은 APP KEY.
            secret_key (str): 발급받은 SECRET KEY.

        Returns:
            str: 발급된 토큰 (실패 시 None).
        """
        url = f"{self.base_url}/oauth2/token"
        headers = {"Content-Type": "application/json;charset=UTF-8"}
        data = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "secretkey": secret_key
        }
        
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                result = response.json()
                if result.get("return_code") == 0:
                    return result.get("token")
                else:
                    print(f"토큰 발급 실패: {result.get('return_msg')}")
        except Exception as e:
            print(f"통신 에러: {e}")
        return None

    def get_account_list(self, token):
        """연결된 계좌 번호 목록을 조회합니다 (ka00001).

        Args:
            token (str): 발급된 접근 토큰.

        Returns:
            dict: API 응답 결과.
        """
        url = f"{self.base_url}/api/dostk/acnt"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka00001",
            "authorization": f"Bearer {token}"
        }
        data = {} # 파라미터 없음
        
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data), timeout=10)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"API 호출 에러: {e}")
        return None

    def get_stock_info(self, token, stock_code):
        """주식 기본 정보를 조회합니다 (ka10001).

        Args:
            token (str): 발급된 접근 토큰.
            stock_code (str): 종목 코드 (예: '005930').

        Returns:
            dict: API 응답 결과 (실패 시 None).
        """
        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka10001",
            "authorization": f"Bearer {token}"
        }
        data = {"stk_cd": stock_code}
        
        try:
            response = requests.post(url, headers=headers, data=json.dumps(data), timeout=10)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"종목 정보 조회 에러: {e}")
        return None

    def get_bulk_stock_info(self, token, stock_codes):
        """여러 종목의 정보를 한 번에 조회합니다 (ka10095).

        Args:
            token (str): 발급된 접근 토큰.
            stock_codes (list or str): 종목 코드 리스트 또는 파이프(|)로 구분된 문자열.

        Returns:
            dict: API 응답 결과 (실패 시 None).
        """
        if isinstance(stock_codes, list):
            stock_codes_str = "|".join(stock_codes)
        else:
            stock_codes_str = stock_codes

        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": "ka10095",
            "authorization": f"Bearer {token}",
            "cont-yn": "N",
            "next-key": ""
        }
        data = {"stk_cd": stock_codes_str}
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=15)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Bulk 종목 정보 조회 실패 (Status: {response.status_code}): {response.text}")

        except Exception as e:
            print(f"Bulk 종목 정보 조회 에러: {e}")
        return None


    def check_all_connections(self):
        """모든 계정의 연결 상태를 확인하고 결과를 반환합니다.

        Returns:
            list: 각 계정의 연결 테스트 결과가 담긴 딕셔너리 리스트.
        """
        accounts = self.settings.get("accounts", [])
        results = []

        for acc in accounts:
            broker = acc.get("broker")
            acc_name = acc.get("account")
            app_key = acc.get("app_key")
            secret_key = acc.get("secret_key")

            result = {
                "broker": broker,
                "account": acc_name,
                "token_success": False,
                "api_success": False,
                "message": "",
                "acct_no": ""
            }

            token = self.get_access_token(app_key, secret_key)
            if token:
                result["token_success"] = True
                api_res = self.get_account_list(token)
                if api_res and api_res.get("return_code") == 0:
                    result["api_success"] = True
                    result["acct_no"] = api_res.get("acctNo")
                    result["message"] = "연결 성공"
                else:
                    msg = api_res.get("return_msg") if api_res else "응답 없음"
                    result["message"] = f"API 호출 실패: {msg}"
            else:
                result["message"] = "토큰 발급 실패"
            
            results.append(result)
        
        return results

    def ping(self):
        """등록된 모든 계정에 대해 순차적으로 연결 테스트를 진행하고 결과를 출력합니다."""
        results = self.check_all_connections()
        if not results:
            print("[WARN] 등록된 계정 정보가 없습니다.")
            return

        print(f"[INFO] 총 {len(results)}개의 계정에 대해 테스트를 시작합니다...\n")
        
        for i, res in enumerate(results, 1):
            print(f"[{i}] {res['broker']} 계좌 ({res['account']}) 테스트 중...")
            if res["token_success"]:
                print("  [OK] 1단계: 토큰 발급 성공")
                if res["api_success"]:
                    print(f"  [OK] 2단계: API 연결 성공 (계좌: {res['acct_no']})")
                else:
                    print(f"  [FAIL] 2단계: {res['message']}")
            else:
                print(f"  [FAIL] 1단계: {res['message']}")
            print("-" * 40)

if __name__ == "__main__":
    # 스크립트로 직접 실행 시 테스트 수행
    api = KiwoomAPI()
    api.ping()
