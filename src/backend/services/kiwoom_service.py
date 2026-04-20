import httpx
import logging
import datetime
from sqlalchemy.orm import Session
from ..models import Stock, SyncHistory
from src.kiwoom.auth import KiwoomAuthManager

logger = logging.getLogger("KiwoomStockService")

class KiwoomStockService:
    """키움증권 REST API를 사용하여 주식 종목 정보를 관리하는 서비스 클래스입니다.
    
    이 서비스는 ka10099 API를 사용하여 KOSPI, KOSDAQ 종목 리스트를 가져오고
    로컬 데이터베이스에 동기화하는 기능을 제공합니다.
    """
    
    API_ID = "ka10099"
    
    def __init__(self):
        self.auth_manager = KiwoomAuthManager()
        # base_url은 auth_manager에서 로드된 정보를 사용합니다.
        self.base_url = self.auth_manager.base_url if self.auth_manager.base_url else "https://api.kiwoom.com"

    async def fetch_stock_list(self, market_type: str):
        """특정 시장의 종목 리스트를 가져옵니다.
        
        Args:
            market_type (str): "0" (코스피), "10" (코스닥)
            
        Returns:
            list: 종목 정보 리스트
        """
        token = await self.auth_manager.get_valid_token()
        url = f"{self.base_url}/api/dostk/stkinfo"
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "api-id": self.API_ID,
            "authorization": f"Bearer {token}"
        }
        payload = {"mrkt_tp": market_type}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                if data.get("return_code") == "0": # return_code는 문자열일 수 있으므로 유연하게 처리
                    return data.get("list", [])
                elif data.get("return_code") == 0:
                    return data.get("list", [])
                else:
                    logger.error(f"종목 리스트 조회 실패 ({market_type}): {data.get('return_msg')}")
                    return []
            except Exception as e:
                logger.error(f"API 호출 중 오류 발생 ({market_type}): {str(e)}")
                return []

    async def sync_all_stocks(self, db: Session, force_reset: bool = False):
        """코스피와 코스닥의 모든 종목을 DB에 동기화합니다.
        
        기존 종목은 업데이트하고, 새 종목은 추가하며, 
        API 결과에 없는 기존 종목(상장폐지 등)은 삭제합니다.
        
        Args:
            db (Session): 데이터베이스 세션
            force_reset (bool): True이면 동기화 전 모든 기존 데이터를 삭제합니다.
            
        Returns:
            int: 동기화된 총 종목 수
        """
        logger.info(f"종목 동기화 프로세스 시작 (force_reset={force_reset})...")
        
        if force_reset:
            db.query(Stock).delete()
            db.commit()
            logger.info("기존 종목 데이터를 초기화했습니다.")

        kospi_list = await self.fetch_stock_list("0")
        kosdaq_list = await self.fetch_stock_list("10")
        
        all_fetched_stocks = kospi_list + kosdaq_list
        logger.info(f"API로부터 총 {len(all_fetched_stocks)}개의 종목 정보를 수신했습니다.")
        
        if not all_fetched_stocks:
            logger.warning("수신된 종목 정보가 없어 동기화 작업을 중단합니다.")
            return 0

        # 현재 DB에 있는 모든 종목 코드와 객체를 맵으로 한 번에 로드 (성능 최적화)
        existing_stocks = {s.stock_code: s for s in db.query(Stock).all()}
        fetched_codes = set()
        
        count_new = 0
        count_updated = 0
        
        # Upsert (Update or Insert) 수행
        for item in all_fetched_stocks:
            code = item.get("code")
            name = item.get("name")
            market_name = item.get("marketName")
            
            if not code:
                continue
                
            fetched_codes.add(code)
            
            if code in existing_stocks:
                stock = existing_stocks[code]
                if stock.stock_name != name or stock.market != market_name:
                    stock.stock_name = name
                    stock.market = market_name
                    count_updated += 1
            else:
                new_stock = Stock(stock_code=code, stock_name=name, market=market_name)
                db.add(new_stock)
                count_new += 1
        
        # 상장폐지 종목 삭제: API 결과에 없는 기존 DB 종목 제거
        existing_codes = set(existing_stocks.keys())
        codes_to_delete = existing_codes - fetched_codes
        if codes_to_delete:
            db.query(Stock).filter(Stock.stock_code.in_(codes_to_delete)).delete(synchronize_session=False)
            logger.info(f"{len(codes_to_delete)}개의 종목이 DB에서 제거되었습니다. (상장폐지 등)")

        # 동기화 이력 업데이트 또는 생성
        history = db.query(SyncHistory).first()
        if history:
            history.last_sync_at = datetime.datetime.now()
        else:
            history = SyncHistory(last_sync_at=datetime.datetime.now())
            db.add(history)
            
        db.commit()
        logger.info(f"데이터베이스 동기화 완료. (신규: {count_new}, 업데이트: {count_updated}, 제거: {len(codes_to_delete)})")
        return len(all_fetched_stocks)

    def get_last_sync_date(self, db: Session):
        """마지막 동기화 날짜를 반환합니다.
        
        Args:
            db (Session): 데이터베이스 세션
            
        Returns:
            datetime.date | None: 마지막 동기화 일자 (기록이 없으면 None)
        """
        history = db.query(SyncHistory).first()
        if history and history.last_sync_at:
            return history.last_sync_at.date()
        return None
