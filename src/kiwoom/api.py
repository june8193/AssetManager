import os
import json
import requests

class KiwoomAPI:
    """키움증권 Open API (REST) 연동 클래스

    이 클래스는 계정 정보를 관리하고, 토큰 발급 및 계좌 정보 조회 등
    기본적인 API 연동 기능을 제공합니다.
    """

    def __init__(self, secrets_path="secrets.json"):
        """KiwoomAPI 초기화

        Args:
            secrets_path (str): 계정 정보가 담긴 secrets.json 파일 경로.
        """
        self.secrets = self._load_secrets(secrets_path)
        self.base_url = self.secrets.get("base_url", "https://api.kiwoom.com")

    def _load_secrets(self, path):
        """secrets.json 파일을 로드합니다.

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
            response = requests.post(url, headers=headers, data=json.dumps(data))
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"API 호출 에러: {e}")
        return None

    def ping(self):
        """등록된 모든 계정에 대해 순차적으로 연결 테스트를 진행합니다."""
        accounts = self.secrets.get("accounts", [])
        if not accounts:
            print("[WARN] 등록된 계정 정보가 없습니다.")
            return

        print(f"[INFO] 총 {len(accounts)}개의 계정에 대해 테스트를 시작합니다...\n")
        
        for i, acc in enumerate(accounts, 1):
            broker = acc.get("broker")
            acc_name = acc.get("account")
            app_key = acc.get("app_key")
            secret_key = acc.get("secret_key")
            
            print(f"[{i}] {broker} 계좌 ({acc_name}) 테스트 중...")
            
            token = self.get_access_token(app_key, secret_key)
            if token:
                print("  [OK] 1단계: 토큰 발급 성공")
                result = self.get_account_list(token)
                if result and result.get("return_code") == 0:
                    print(f"  [OK] 2단계: API 연결 성공 (계좌: {result.get('acctNo')})")
                else:
                    print(f"  [FAIL] 2단계: API 호출 실패 -> {result.get('return_msg') if result else '응답 없음'}")
            else:
                print("  [FAIL] 1단계: 토큰 발급 실패")
            print("-" * 40)

if __name__ == "__main__":
    # 스크립트로 직접 실행 시 테스트 수행
    api = KiwoomAPI()
    api.ping()
