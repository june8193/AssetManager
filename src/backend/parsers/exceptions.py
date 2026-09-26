"""지출 명세서 파서 관련 예외 클래스 모듈."""


class ExpenseParserError(Exception):
    """지출 명세서 파싱 중 발생하는 최상위 기본 예외 클래스."""

    pass


class ExpenseDecryptionError(ExpenseParserError):
    """명세서 복호화 과정 중 발생하는 예외 클래스."""

    pass


class InvalidPasswordError(ExpenseDecryptionError):
    """명세서 복호화 비밀번호가 일치하지 않을 때 발생하는 예외 클래스."""

    pass


class UnsupportedFileFormatError(ExpenseParserError):
    """지원하지 않는 파일 형식이나 파싱 불가능한 구조일 때 발생하는 예외 클래스."""

    pass
