# -*- coding: utf-8 -*-
"""프로젝트 전역에서 공통으로 사용하는 유틸리티 함수 모듈입니다."""


def format_exception(exc: Exception) -> str:
    """예외 메시지가 비어 있어도 예외 클래스명이 남도록 문자열을 포맷합니다.

    Args:
        exc: 포맷할 예외 인스턴스

    Returns:
        예외 클래스명과 메시지가 결합된 문자열
    """
    return f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
