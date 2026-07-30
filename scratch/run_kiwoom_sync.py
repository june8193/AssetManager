# -*- coding: utf-8 -*-
import asyncio
import json
from src.backend.database import SessionLocal
from src.backend.services.kiwoom_sync_service import KiwoomTransactionService

async def test_sync():
    db = SessionLocal()
    try:
        service = KiwoomTransactionService()
        result = await service.sync_transactions(db, days=2)
        print("=== sync_transactions(days=2) 결과 ===")
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_sync())
