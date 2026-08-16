# 은행 계좌 스냅샷 손익 계산 기준 통일 및 DB 마이그레이션 계획

## 1. 배경 및 원인 분석

### 1.1 이슈 현상
* 카카오뱅크 계좌(`3333-19-6950366`)의 스냅샷 조회 시 기간 수익(손익)이 계속 **`-3,498,542원`**으로 고정되어 표시되는 현상 발생.

### 1.2 원인 분석 결과
1. **손익 수치(`-3,498,542원`)의 근원**:
   * 해당 계좌의 누적 이자 수입(`INTEREST`): `+282,658원` (총 5회)
   * 해당 계좌의 누적 세금 지출(`TAX`): `-3,781,200원` (지방세/국세 등 2회)
   * 누적 순손익 = $+282,658\text{원} - 3,781,200\text{원} = \mathbf{-3,498,542\text{원}}$ (정확히 일치)
2. **이후 스냅샷에서도 수치가 동일하게 유지된 이유**:
   * 은행 계좌 스냅샷 생성 로직(`SnapshotEngine._update_bank_previews`)에서 손익을 `현재 총평가액(잔액) - 누적 순입금액(총 입금 - 총 출금)`으로 계산하여 **누적 손익**을 저장하고 있었음.
   * 2026-07-26 이후에는 추가적인 이자/세금 없이 일반 입출금(`DEPOSIT`, `WITHDRAW`)만 발생함.
   * 단순 입출금 발생 시 잔액과 누적 입금액이 동일한 크기로 증감하므로, 누적 손익($\text{잔액} - \text{원금}$)은 변하지 않고 계속 `-3,498,542원`으로 유지됨.
3. **구조적 불일치 문제**:
   * **증권 계좌**: 직전 스냅샷 대비 **기간 손익(Period Profit)**으로 계산하여 저장 (`val - last_val - period_deposit`).
   * **은행 계좌**: 생성 시점부터의 **누적 손익(Total Profit)**으로 계산하여 저장 (`val - net_deposits`).
   * **UI 표기**: `SnapshotsTab.jsx` 테이블 헤더에는 **`기간 수익`**으로 표기되어 있어 사용자가 기간별 수익으로 오인.

---

## 2. 개선 및 설계 방향

### 2.1 손익 계산 기준 통일 (Period Profit)
* `account_snapshots` 테이블의 `total_profit` 컬럼에 저장되는 값을 **'직전 스냅샷 대비 기간 손익'**으로 모든 계좌 유형에 대해 일관되게 통일.
* 은행 계좌도 직전 스냅샷 기준 기간 손익 산출 공식 적용:
  $$\text{기간 손익} = \text{현재 총평가액} - \text{직전 총평가액} - \text{기간 순입금액}$$
  *(기간 순입금액 = 기간 내 입금 - 기간 내 출금)*
  * 이를 통해 해당 기간 동안 발생한 순수 이자, 세금, 캐시 보정액의 합이 기간 손익으로 정확히 기록됨.

### 2.2 스키마 및 마법사(SnapshotWizard) 정돈
* `BankCalculateResponse`에 `period_deposit`(기간 순입금액), `period_profit`(기간 손익) 필드를 추가.
* 스냅샷 마법사 은행 계좌 스텝에서 기간 순입금액과 기간 손익을 명확히 표시하고 사용자에게 직관적인 피드백 제공.

### 2.3 프론트엔드 DB 관리 탭 헤더 명확화
* `SnapshotsTab.jsx`의 컬럼 명칭과 툴팁을 `기간 입금액`, `총 평가액`, `기간 손익`으로 일관되게 정돈.

---

## 3. 세부 구현 계획

### 3.1 백엔드 수정
1. **`src/backend/schemas/snapshot.py`**
   * `BankCalculateResponse` 스키마에 `period_deposit: float = 0.0`, `period_profit: float = 0.0` 추가.
2. **`src/backend/services/snapshot_engine.py`**
   * `calculate_bank`: 기간 순입금액(`total_deposit - total_withdraw`) 및 기간 손익(`theoretical_krw - last_valuation - period_deposit`) 계산 및 반환.
   * `_update_bank_previews`: 은행 계좌의 `period_deposit` 및 `total_profit`(기간 손익)을 직전 스냅샷 기준으로 계산하도록 수정.

### 3.2 프론트엔드 수정
1. **`src/frontend/src/pages/SnapshotWizardPage.jsx`**
   * 은행 계좌 스텝에서 `calc.period_deposit` 및 `calc.period_profit`을 안전하게 렌더링하도록 점검.
2. **`src/frontend/src/components/db/SnapshotsTab.jsx`**
   * 테이블 컬럼명 `기간 입금액`, `총 평가액`, `기간 손익` 확인 및 서식 정돈.

### 3.3 DB 마이그레이션 스크립트 작성 (`scripts/migrate_bank_snapshots.py`)
* 모든 은행 계좌(`account_type == 'BANK'`)의 스냅샷 레코드들을 `snapshot_date` 오름차순으로 순회.
* 각 스냅샷에 대해:
  1. 직전 스냅샷 조회 (`snapshot_date < current_date`)
  2. 해당 기간(`last_date < tx_date <= current_date`) 내의 순입금액(`DEPOSIT - WITHDRAW`) 계산 $\rightarrow$ `period_deposit` 업데이트
  3. 기간 손익(`total_valuation - last_valuation - period_deposit`) 계산 $\rightarrow$ `total_profit` 업데이트
* 마이그레이션 전/후 변경 요약 출력 및 안전한 트랜잭션 커밋 처리.

---

## 4. 서버 PC 실행 절차

서버 PC에서 작업을 수행할 때 아래 단계를 순서대로 진행합니다.

1. **저장소 최신화**:
   ```bash
   git pull
   ```
2. **단위 테스트 실행 (TDD)**:
   ```bash
   uv run pytest tests/test_snapshot_engine.py
   ```
3. **서버 DB 백업 (권장)**:
   ```bash
   # SQLite DB 파일 백업
   cp src/assets.db src/assets_backup_$(date +%Y%m%d_%H%M%S).db
   ```
4. **마이그레이션 스크립트 실행**:
   ```bash
   uv run scripts/migrate_bank_snapshots.py
   ```
5. **마이그레이션 결과 확인**:
   ```bash
   uv run scripts/db_query.py "SELECT snapshot_date, period_deposit, total_valuation, total_profit FROM account_snapshots WHERE account_id = 13 ORDER BY snapshot_date ASC"
   ```
6. **서버 재기동 및 UI 동작 확인**.
