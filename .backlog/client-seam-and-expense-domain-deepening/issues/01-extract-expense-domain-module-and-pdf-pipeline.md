# 01 — 지출 도메인 모듈 추출 및 PDF 단일 복호화 파이프라인 구축

**Spec:** [spec.md](../spec.md)

**What to build:** 1,363줄 지출 라우터에 구현된 자동분류 규칙 매칭, 다중 청구월 덮어쓰기 커밋, 미분류 차단, 동기간 대비 통계 집계를 깊은 지출 도메인 모듈로 추출하고, 암호화 PDF 명세서 업로드 시 기관 판별과 파싱에서 발생하던 이중 복호화를 단일 파이프라인으로 통합한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 지출 도메인 모듈이 HTTP 객체(`UploadFile`, `Form`, `HTTPException`) 의존 없이 인메모리 SQLite 세션만으로 미리보기·커밋·통계·규칙 관리를 수행한다.
- [ ] 암호화 PDF(국민/신한 등) 업로드 미리보기 시 PDF 복호화 및 텍스트 추출이 1회만 수행된다.
- [ ] 지출 라우터가 얇은 HTTP 입출력 변환 어댑터로 축소된다.
- [ ] `uv run pytest`로 지출 도메인 및 라우터 테스트가 모두 통과한다.
