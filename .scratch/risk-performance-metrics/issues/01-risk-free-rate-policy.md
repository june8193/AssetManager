Title: 무위험 수익률(Risk-free Rate) 정의 및 관리 방식 결정
Type: grilling
Status: resolved
Blocked by: none

## Question

샤프 지수와 소티노 지수를 계산할 때 필수 요소인 **무위험 수익률(Risk-free Rate, $R_f$)**을 어떠한 기준과 방식으로 정의하고 관리할 것인가?

## Answer

- **결정**: 무위험 수익률(Risk-free Rate)은 웹 UI(설정 화면 또는 성과 분석 페이지)에서 사용자가 직접 입력/수정할 수 있도록 하고, 입력된 설정값은 **데이터베이스(DB)**에 저장하여 지속 관리합니다. (기본값 예: 연 3.5%)
- `settings.toml`과 같은 로컬 파일 대신 DB(예: 시스템/사용자 설정 테이블)에 저장하므로, 웹을 통해 손쉽게 관리할 수 있고 보안 파일 분리 없이 일관된 API로 조회가 가능합니다.
