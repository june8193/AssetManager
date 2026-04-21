# 작업 계획: 대시보드 비활성 계좌 필터링 및 자산 왜곡 수정

## 1. 개요
비활성 계좌가 대시보드 합계 및 목록에 포함되는 문제를 해결하기 위해 백엔드 서비스의 필터링 로직을 강화합니다.

## 2. 작업 단계

### 2.1. [RED] 테스트 코드 작성 및 실패 확인
- **목표**: 비활성 계좌 데이터가 대시보드 결과에 포함되는 문제를 확인하는 테스트 작성.
- **내용**:
    - `tests/test_dashboard_filter.py` 생성.
    - **데이터베이스 격리**: `pytest`의 `sqlite` 인메모리 DB 또는 임시 파일 DB를 사용하여 테스트 데이터 구성 (운영 DB 영향 차단).
    - 비활성 계좌와 활성 계좌 데이터를 생성하고, `get_holdings` 및 `get_yearly_stats` 호출 시 비활성 계좌 데이터가 포함되어 있음을 검증(실패 유도).

### 2.2. [GREEN] 필터링 로직 수정 및 테스트 통과
- **목표**: 최소한의 코드 수정으로 테스트 통과.
- **내용**:
    - `src/backend/services/dashboard_service.py` 수정.
    - `get_holdings`, `get_yearly_stats`에 `Account.is_active == True` 필터 추가.
    - 작성한 테스트를 실행하여 성공 확인.

### 2.3. [REFACTOR] 코드 최적화 및 E2E 검증
- **목표**: 코드 품질 개선 및 실제 동작 확인.
- **내용**:
    - 쿼리 중복 제거 및 가독성 개선.
    - `dev.py`를 실행하여 실제 프론트엔드 대시보드에서 비활성 계좌가 사라졌는지 E2E 브라우저 테스트로 최종 확인.

## 3. 상세 구현 계획

### get_holdings 수정
```python
# AS-IS
transactions = self.db.query(Transaction).all()

# TO-BE
transactions = self.db.query(Transaction).join(Account).filter(Account.is_active == True).all()
```

### get_yearly_stats 수정
```python
# AS-IS
snapshots = self.db.query(AccountSnapshot).all()

# TO-BE
snapshots = self.db.query(AccountSnapshot).join(Account).filter(Account.is_active == True).all()
```

## 4. 리스크 및 고려사항
- **성능**: `join`을 사용한 필터링이 트랜잭션 양이 많을 때 성능에 영향을 주는지 확인. (필요시 인덱스 추가)
- **과거 데이터**: 비활성 계좌를 제외했을 때 과거 특정 연도의 통계가 완전히 사라지는 부작용이 있는지 체크.
