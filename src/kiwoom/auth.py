import os
import json
import tomllib
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from pathlib import Path

class KiwoomAuthManager:
    """키움증권 API 인증 및 모든 설정을 관리하는 싱글톤 클래스입니다.
    
    인증 정보 및 접속 URL 등 모든 설정은 프로젝트 루트의 settings.toml 파일에서 로드합니다.
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
            
        # 계좌별 토큰 캐싱 딕셔너리: {account_name: {"token": token, "expired_at": expired_at}}
        instance._tokens: Dict[str, Dict] = {}
        
        # URL 초기화 (settings.toml에서 로드 필수)
        instance.base_url = None
        instance.accounts_config = {}
        
        # settings.toml 로드
        instance._load_credentials()

    def _load_credentials(self):
        """settings.toml 파일로부터 모든 인증 및 설정 정보를 로드합니다."""
        project_root = Path(__file__).parent.parent.parent
        settings_path = project_root / "settings.toml"
        
        if not settings_path.exists():
            self.logger.error(f"설정 파일({settings_path})을 찾을 수 없습니다.")
            raise FileNotFoundError("settings.toml 파일이 필요합니다.")
            
        try:
            with open(settings_path, "rb") as f:
                settings = tomllib.load(f)
                
            self.base_url = settings.get("base_url")
            
            if not self.base_url:
                raise ValueError("settings.toml에 필수 설정 정보(base_url)가 누락되었습니다.")

            accounts = settings.get("accounts", [])
            
            if not accounts:
                raise ValueError("settings.toml에 계정 정보(accounts)가 없습니다.")
                
            # 전체 계정 정보 로드 및 맵 구성
            self.accounts_config = {}
            for acc in accounts:
                acc_name = acc.get("account")
                if acc_name:
                    self.accounts_config[acc_name] = {
                        "app_key": acc.get("app_key"),
                        "secret_key": acc.get("secret_key")
                    }
            
            self.logger.info("모든 설정을 settings.toml에서 성공적으로 로드했습니다.")
            
        except Exception as e:
            self.logger.error(f"설정 로드 중 오류 발생: {str(e)}")
            raise

    async def get_valid_token(self, account_name: Optional[str] = None) -> str:
        """유효한 토큰을 반환합니다. 만료되었거나 없을 경우 재발급합니다.
        
        Args:
            account_name (str, optional): 토큰을 발급받을 계좌번호. 생략 시 첫 번째 계좌를 사용합니다.
            
        Returns:
            str: 유효한 Bearer 접근 토큰
        """
        if not account_name:
            if not self.accounts_config:
                raise ValueError("설정된 계좌 정보가 없습니다.")
            account_name = list(self.accounts_config.keys())[0]

        if account_name not in self.accounts_config:
            raise ValueError(f"설정에 등록되지 않은 계좌입니다: {account_name}")

        token_info = self._tokens.get(account_name)
        if token_info and token_info.get("expired_at") and token_info["expired_at"] > datetime.now():
            return token_info["token"]
        
        return await self._refresh_token(account_name)

    async def _refresh_token(self, account_name: str) -> str:
        """키움 API를 호출하여 특정 계좌에 대한 토큰을 새롭게 발급받습니다 (au10001)."""
        config = self.accounts_config[account_name]
        app_key = config["app_key"]
        secret_key = config["secret_key"]
        
        url = f"{self.base_url}/oauth2/token"
        headers = {"Content-Type": "application/json;charset=UTF-8"}
        data = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "secretkey": secret_key
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=data)
                response.raise_for_status()
                result = response.json()
                
                if result.get("return_code") == 0:
                    access_token = result.get("token")
                    expires_in = int(result.get("expires_in", 3600))
                    expired_at = datetime.now() + timedelta(seconds=expires_in - 60)
                    
                    self._tokens[account_name] = {
                        "token": access_token,
                        "expired_at": expired_at
                    }
                    
                    self.logger.info(f"토큰 발급 성공 (계좌: {account_name})")
                    self.log_token_info(account_name)
                    return access_token
                else:
                    error_msg = result.get("return_msg", "알 수 없는 오류")
                    self.logger.error(f"토큰 발급 실패 (계좌: {account_name}): {error_msg}")
                    raise Exception(f"Kiwoom Auth Error: {error_msg}")
                    
            except httpx.HTTPStatusError as e:
                self.logger.error(f"HTTP 오류 발생: {e.response.status_code}")
                raise
            except Exception as e:
                self.logger.error(f"토큰 갱신 중 예외 발생 (계좌: {account_name}): {str(e)}")
                raise

    def log_token_info(self, account_name: str):
        """본문에 중요한 토큰 정보를 마스킹하여 로그에 출력합니다."""
        token_info = self._tokens.get(account_name)
        if not token_info:
            self.logger.info(f"토큰 정보 없음 (계좌: {account_name})")
            return
            
        token = token_info["token"]
        expired_at = token_info["expired_at"]
        masked_token = f"{token[:2]}***{token[-2:]}"
        self.logger.info(f"현재 토큰 (마스킹, 계좌: {account_name}): {masked_token} (만료 예정: {expired_at})")




