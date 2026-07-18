# -*- coding: utf-8 -*-
"""거래 내역 조회를 위한 MCP 도구 함수 모음입니다.
"""

import datetime
from typing import Optional

from sqlalchemy.orm import joinedload
from src.backend.database import SessionLocal
from src.backend.models import Transaction

async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """전체 거래 및 리밸런싱 관련 매수/매도 거래 내역 목록을 조회합니다.

    Args:
        start_date (str, optional): 조회 시작일 (YYYY-MM-DD)
        end_date (str, optional): 조회 종료일 (YYYY-MM-DD)

    Returns:
        dict: 일자 정렬된 상세 거래 내역 목록
    """
    db = SessionLocal()
    try:
        query = db.query(Transaction).options(joinedload(Transaction.asset))
        if start_date:
            query = query.filter(Transaction.transaction_date >= datetime.date.fromisoformat(start_date))
        if end_date:
            query = query.filter(Transaction.transaction_date <= datetime.date.fromisoformat(end_date))

        transactions = query.order_by(Transaction.transaction_date.desc()).all()

        formatted = []
        for t in transactions:
            formatted.append({
                "id": t.id,
                "account_id": t.account_id,
                "asset_id": t.asset_id,
                "transaction_date": t.transaction_date.strftime("%Y-%m-%d"),
                "type": t.type,
                "quantity": t.quantity,
                "price": t.price,
                "total_amount": t.total_amount,
                "currency": t.currency,
                "exchange_rate": t.exchange_rate,
                "memo": t.memo,
                "asset_name": t.asset.name if t.asset else None,
                "asset_ticker": t.asset.ticker if t.asset else None,
            })

        return {"transactions": formatted}
    except ValueError:
        return {"error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식을 활용해 주세요."}
    except Exception as e:
        return {"error": f"거래 내역 조회 중 오류 발생: {str(e)}"}
    finally:
        db.close()
