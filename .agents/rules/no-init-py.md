
# __init__.py 사용 금지

- `__init__.py` 파일을 생성하지 않습니다.
- Python 3.3+ 이상에서는 implicit namespace packages를 지원하므로 `__init__.py`가 없어도 패키지로 인식됩니다.
- 패키지 초기화 로직이 반드시 필요한 경우에만 예외적으로 허용하며, 이 경우 사유를 주석으로 명시합니다.
