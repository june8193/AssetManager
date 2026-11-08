# -*- coding: utf-8 -*-
"""벤치마크 다기간 성과 및 보유 종목 손익 기여도(Attribution) 조회를 위한 MCP 도구 함수 모음입니다.
백엔드 API 서버를 호출하여 데이터를 가져옵니다.
"""

from typing import Any, Dict, Optional
from src.mcp.client import api_client


async def get_benchmark_attribution(as_of_date: Optional[str] = None) -> Dict[str, Any]:
    """포트폴리오의 4개 기간(1M, 3M, 1Y, YTD) 벤치마크 성과(S&P 500, 나스닥, 코스피 대비 Alpha) 및
    종목별 실제 발생 손익(Actual P&L) 기반 기여도(Attribution, Top/Bottom 3 랭킹 포함)를 조회합니다.

    핵심 산출 원칙 및 스키마 특성:
    1. 실제 발생 손익(Actual P&L) 기반 기여도 산출:
       - 단순 기말비중 × 기간 주가등락률 방식의 왜곡(미보유 기간 수익 산입 등)을 배제하고,
         단일 원장 엔진(LedgerEngine)의 실제 거래 체결 내역과 시세를 결합하여 계산합니다.
       - 기간 중도 매수(물타기/불타기) 및 일부 매도의 실제 투입 원금과 실현/미실현 손익이 정확히 반영됩니다.
    2. 자본 손익과 배당/세금 손익 분리:
       - 순수 주가 변동에 따른 자본 손익(`capital_pnl`, `capital_returns`)과
         기간 내 발생한 세후 배당/이자 손익(`dividend_pnl`)을 분리하여 제공합니다.
       - 총 손익(`total_pnl`) = `capital_pnl` + `dividend_pnl`
    3. 포지션 실제 수익률 vs 시장 단순 주가 등락률:
       - `capital_returns`: 내 포지션의 실제 자본수익률(%) = `(capital_pnl / invested_capital) * 100`
       - `returns`: 내 포지션의 실제 총수익률(자본+배당, %) = `(total_pnl / invested_capital) * 100`
       - `price_returns`: 해당 기간 종목의 단순 시장 주가 등락률(보조 지표, %)
    4. 다기간 기여도 3종 (%p):
       - `capital_contributions`: 자본 수익기여도 (%p)
       - `dividend_contributions`: 배당 수익기여도 (%p)
       - `contributions`: 총 수익기여도 (자본 + 배당 합산, %p)
    5. 통화 정합성 및 기준일 단일 환율 적용:
       - 미국 종목(`currency == 'USD'`)은 기본 손익(`capital_pnl`, `dividend_pnl`, `total_pnl`)과
         포지션 수익률(`capital_returns`, `returns`)을 순수 달러(USD) 기준으로 산출합니다.
       - 보조 지표인 원화 환산 손익(`*_krw`) 및 포트폴리오 기여도(`contributions %p`) 계산 시에만
         기준일(`as_of_date`)의 단일 환율을 적용하여 포트폴리오 전체 체급과 정합성을 맞춥니다.
    6. 기간 중 전량 매도 종목(CLOSED) 포함:
       - 분석 기간(1M, 3M, 1Y, YTD) 중 보유했거나 매매 이력이 있는 종목은 현재 잔고가 0주라도
         `status: "CLOSED"`, `weight: 0.0`으로 분석 대상 및 Top/Bottom 3 랭킹에 정상 포함되어
         손절매/익절매 거래가 감사에서 누락되지 않습니다.

    Args:
        as_of_date (Optional[str]): 조회 기준일 (YYYY-MM-DD 형식). 미입력 시 오늘 기준.

    Returns:
        Dict[str, Any]: 벤치마크 성과 및 종목별 손익 기여도 요약 딕셔너리
            - as_of_date (str): 기준일자 (YYYY-MM-DD)
            - benchmarks (Dict[str, Dict[str, float]]): 4개 기간별(1M, 3M, 1Y, YTD) 지표
                - portfolio (float): 포트폴리오 기간 누적 수익률 (%)
                - sp500 (float): S&P 500 기간 누적 수익률 (%)
                - nasdaq (float): 나스닥 기간 누적 수익률 (%)
                - kospi (float): 코스피 기간 누적 수익률 (%)
                - alpha_vs_sp500 (float): S&P 500 대비 초과수익률 (%p)
            - top_contributors_ytd (List[Dict[str, Any]]): YTD 상위 기여 종목 (최대 3개)
            - top_detractors_ytd (List[Dict[str, Any]]): YTD 부진 종목 (최대 3개)
            - top_contributors_1m (List[Dict[str, Any]]): 1M 상위 기여 종목 (최대 3개)
            - top_detractors_1m (List[Dict[str, Any]]): 1M 부진 종목 (최대 3개)
                - 각 랭킹 아이템: ticker, name, major_category, sub_category, currency,
                  status, weight, capital_pnl, dividend_pnl, total_pnl, total_pnl_krw,
                  capital_return, return, price_return, capital_contribution,
                  dividend_contribution, contribution
            - holdings_attribution (List[Dict[str, Any]]): 전체 종목별 기간 성과 및 기여도 목록
                - ticker (str): 종목 티커
                - name (str): 종목명
                - major_category (str): 대분류 (예: '주식', '채권')
                - sub_category (str): 중분류 (예: '코어(지수)', '알파(성장)')
                - currency (str): 종목 기본 통화 ('KRW' | 'USD')
                - status (str): 보유 상태 ('HOLDING' | 'CLOSED')
                - quantity (float): 기말 보유 수량
                - weight (float): 기말 포트폴리오 비중 (%, CLOSED는 0.0)
                - valuation (float): 기말 평가액 (기본 통화 기준)
                - valuation_krw (int): 기말 원화 환산 평가액
                - capital_pnl (Dict[str, float]): 기간별 자본 손익 (기본 통화)
                - dividend_pnl (Dict[str, float]): 기간별 세후 배당/이자 손익 (기본 통화)
                - total_pnl (Dict[str, float]): 기간별 총 손익 (기본 통화)
                - capital_pnl_krw (Dict[str, int]): 기간별 자본 손익 (KRW 보조)
                - dividend_pnl_krw (Dict[str, int]): 기간별 배당 손익 (KRW 보조)
                - total_pnl_krw (Dict[str, int]): 기간별 총 손익 (KRW 보조)
                - capital_returns (Dict[str, float]): 기간별 내 포지션 자본 수익률 (%)
                - returns (Dict[str, float]): 기간별 내 포지션 총수익률 (자본+배당, %)
                - price_returns (Dict[str, float]): 기간별 단순 시장 주가 등락률 (보조, %)
                - capital_contributions (Dict[str, float]): 기간별 자본 기여도 (%p)
                - dividend_contributions (Dict[str, float]): 기간별 배당 기여도 (%p)
                - contributions (Dict[str, float]): 기간별 총 기여도 (%p)
    """
    try:
        params: Dict[str, Any] = {}
        if as_of_date:
            params["as_of_date"] = as_of_date

        result = await api_client.get("/api/benchmark/attribution", params=params)
        return result
    except Exception as e:
        return {"error": f"벤치마크 기여도 조회 중 오류 발생: {str(e)}"}
