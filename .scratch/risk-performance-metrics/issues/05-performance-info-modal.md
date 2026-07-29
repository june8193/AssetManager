# 05 — AssetManager 실제 계산 알고리즘 안내 모달 (`PerformanceInfoModal`) 구현

**What to build:**
성과 지표 카드 상의 ⓘ (도움말 아이콘) 클릭 시, AssetManager의 실제 계산 알고리즘(단리 $R_{f, daily}$, 입출금 차감 TWR, 불규칙 스냅샷 일별 보간법, 252일 연율화 표준편차, 소티노 하방 편차 수식) 및 수치 해석 팁을 안내하는 상세 모달 팝업 컴포넌트(`PerformanceInfoModal.jsx`)를 구현합니다.

**Blocked by:** 02, 03, 04 — API 및 UI 카드/차트 구현 완료 후 통합

**Status:** ready-for-agent

- [ ] `PerformanceInfoModal.jsx` 컴포넌트 추가
- [ ] 모달 내 탭/섹션별 안내 작성 (AssetManager 실제 연산 수식, 무위험 수익률 적용 방식, 지표별 해석 팁 표)
- [ ] 지표 KPI 카드 옆 ⓘ 아이콘 호버 시 요약 툴팁, 클릭 시 상세 모달 오픈 이벤트 연동
- [ ] E2E 모달 오픈 렌더링 검증 및 스크린샷 캡처
