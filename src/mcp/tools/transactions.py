# -*- coding: utf-8 -*-
"""거래 내역 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Optional
from src.mcp.client import api_client

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
    try:
        params = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
            
        transactions = await api_client.get("/api/db/transactions", params=params)
        if isinstance(transactions, dict) and "error" in transactions:
            return transactions
            
        # 기존 MCP 응답 형식에 맞추어 포맷팅
        formatted = []
        for t in transactions:
            formatted.append({
                "id": t.get("id"),
                "account_id": t.get("account_id"),
                "asset_id": t.get("asset_id"),
                "transaction_date": t.get("transaction_date"),
                "type": t.get("type"),
                "quantity": t.get("quantity"),
                "price": t.get("price"),
                "total_amount": t.get("total_amount"),
                "currency": t.get("currency"),
                "exchange_rate": t.get("exchange_rate"),
                "memo": t.get("memo"),
                "asset_name": t.get("asset_name"),
                "asset_ticker": t.get("asset_ticker"),
            })
            
        return {"transactions": formatted}
    except Exception as e:
        return {"error": f"거래 내역 조회 중 오류 발생: {str(e)}"}
