import os
import json
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from pathlib import Path

class KiwoomAuthManager:
    """키움증권 API 인증 및 모든 설정을 관리하는 싱글톤 클래스입니다.
    
    인증 정보 및 접속 URL 등 모든 설정은 프로젝트 루트의 secrets.json 파일에서 로드합니다.
    """
    
    _instance: Optional['KiwoomAuthManager'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(KiwoomAuthManager, cls).__new__(cls)
            cls._init_manager(cls._instance)
        return cls._instance

    @staticmethod
    def _init_manager(instance: 'KiwoomAuthManager'):
        """인스턴스 초기화 로직 (한 번만 실행됨)"""
        instance.logger = logging.getLogger("KiwoomAuthManager")
        if not instance.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            instance.logger.addHandler(handler)
            instance.logger.setLevel(logging.INFO)
            
        instance._access_token: Optional[str] = None
        instance._expired_at: Optional[datetime] = None
        
        # URL 초기화 (secrets.json에서 로드 필수)
        instance.base_url = None
        instance.ws_url = None
        
        # secrets.json 로드
        instance._load_credentials()

    def _load_credentials(self):
        """secrets.json 파일로부터 모든 인증 및 설정 정보를 로드합니다."""
        project_root = Path(__file__).parent.parent.parent
        secrets_path = project_root / "secrets.json"
        
        if not secrets_path.exists():
            self.logger.error(f"설정 파일({secrets_path})을 찾을 수 없습니다.")
            raise FileNotFoundError("secrets.json 파일이 필요합니다.")
            
        try:
            with open(secrets_path, "r", encoding="utf-8") as f:
                secrets = json.load(f)
                
            self.base_url = secrets.get("base_url")
            self.ws_url = secrets.get("ws_url")
            
            if not self.base_url or not self.ws_url:
                missing = []
                if not self.base_url: missing.append("base_url")
                if not self.ws_url: missing.append("ws_url")
                raise ValueError(f"secrets.json에 필수 설정 정보({', '.join(missing)})가 누락되었습니다.")

            accounts = secrets.get("accounts", [])
            
            if not accounts:
                raise ValueError("secrets.json에 계정 정보(accounts)가 없습니다.")
                
            # 첫 번째 계정 정보 사용
            primary_account = accounts[0]
            self.app_key = primary_account.get("app_key")
            self.app_secret = primary_account.get("secret_key")
            
            if not self.app_key or not self.app_secret:
                raise ValueError("계정 정보에 app_key 또는 secret_key가 누락되었습니다.")
                
            self.logger.info("모든 설정을 secrets.json에서 성공적으로 로드했습니다.")
            
        except Exception as e:
            self.logger.error(f"설정 로드 중 오류 발생: {str(e)}")
            raise

    async def get_valid_token(self) -> str:
        """유효한 토큰을 반환합니다. 만료되었거나 없을 경우 재발급합니다."""
        if self._access_token and self._expired_at and self._expired_at > datetime.now():
            return self._access_token
        
        return await self._refresh_token()

    async def _refresh_token(self) -> str:
        """키움 API를 호출하여 토큰을 새롭게 발급받습니다 (au10001)."""
        url = f"{self.base_url}/oauth2/token"
        headers = {"Content-Type": "application/json;charset=UTF-8"}
        data = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "secretkey": self.app_secret
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=data)
                response.raise_for_status()
                result = response.json()
                
                if result.get("return_code") == 0:
                    self._access_token = result.get("token")
                    expires_in = int(result.get("expires_in", 3600))
                    self._expired_at = datetime.now() + timedelta(seconds=expires_in - 60)
                    
                    self.logger.info("토큰 발급 성공")
                    self.log_token_info()
                    return self._access_token
                else:
                    error_msg = result.get("return_msg", "알 수 없는 오류")
                    self.logger.error(f"토큰 발급 실패: {error_msg}")
                    raise Exception(f"Kiwoom Auth Error: {error_msg}")
                    
            except httpx.HTTPStatusError as e:
                self.logger.error(f"HTTP 오류 발생: {e.response.status_code}")
                raise
            except Exception as e:
                self.logger.error(f"토큰 갱신 중 예외 발생: {str(e)}")
                raise

    def log_token_info(self):
        """본문에 중요한 토큰 정보를 마스킹하여 로그에 출력합니다."""
        if not self._access_token:
            self.logger.info("토큰 정보 없음")
            return
            
        masked_token = f"{self._access_token[:2]}***{self._access_token[-2:]}"
        self.logger.info(f"현재 토큰 (마스킹): {masked_token} (만료 예정: {self._expired_at})")
