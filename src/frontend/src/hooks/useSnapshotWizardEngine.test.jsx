import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSnapshotWizardEngine } from './useSnapshotWizardEngine';
import { snapshotService } from '../services/snapshotService';

vi.mock('../services/snapshotService', () => ({
  snapshotService: {
    fetchWizardInitData: vi.fn(),
    fetchAccountWizardData: vi.fn(),
    calculateBrokerage: vi.fn(),
    calculateBank: vi.fn(),
    saveWizardSnapshot: vi.fn(),
  },
}));

describe('useSnapshotWizardEngine 훅 테스트 (은행 우선 순서)', () => {
  const mockAccounts = [
    { id: 1, name: '미래에셋증권', provider: '미래에셋', account_type: 'BROKERAGE', is_active: true, user_name: '홍길동' },
    { id: 2, name: 'KB국민은행', provider: 'KB국민', account_type: 'BANK', is_active: true, user_name: '홍길동' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    vi.mocked(snapshotService.fetchWizardInitData).mockResolvedValue({
      accounts: mockAccounts,
      latestSnapshotDate: '2026-07-31',
      exchangeRates: [{ date: '2026-08-17', rate: 1350.0 }],
      exchangeRate: '1350.0',
    });

    vi.mocked(snapshotService.fetchAccountWizardData).mockResolvedValue([
      { id: 10, type: 'DEPOSIT', total_amount: 1000000, transaction_date: '2026-08-10' },
    ]);
  });

  it('마운트 시 초기 데이터를 로드하고 기본 상태를 구성한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    expect(result.current.loadingAccounts).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    expect(result.current.step).toBe(1);
    expect(result.current.accounts).toEqual(mockAccounts);
    expect(result.current.latestSnapshotDate).toBe('2026-07-31');
    expect(result.current.exchangeRate).toBe('1350.0');
    expect(result.current.brokerageAccounts).toHaveLength(1);
    expect(result.current.bankAccounts).toHaveLength(1);
  });

  it('계좌 선택 토글 및 은행/증권 전체 선택/해제가 동작한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 은행 계좌 토글
    act(() => {
      result.current.toggleAccountSelection(2);
    });
    expect(result.current.selectedAccountIds).toContain(2);

    act(() => {
      result.current.toggleAccountSelection(2);
    });
    expect(result.current.selectedAccountIds).not.toContain(2);

    // 은행 전체 선택
    act(() => {
      result.current.selectAllBank(true);
    });
    expect(result.current.selectedAccountIds).toContain(2);

    // 은행 전체 해제
    act(() => {
      result.current.selectAllBank(false);
    });
    expect(result.current.selectedAccountIds).not.toContain(2);

    // 증권 전체 선택
    act(() => {
      result.current.selectAllBrokerage(true);
    });
    expect(result.current.selectedAccountIds).toContain(1);
  });

  it('Step 1에서 은행 계좌 선택 후 Step 2(은행 상세 입력)로 전이한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    act(() => {
      result.current.toggleAccountSelection(2);
    });

    act(() => {
      result.current.goToNext();
    });

    await waitFor(() => {
      expect(result.current.step).toBe(2);
      expect(result.current.currentAccIdx).toBe(0);
      expect(result.current.accountsFormData[2]).toBeDefined();
    });
  });

  it('Step 1에서 은행 미선택 시 확인창을 통해 Step 3(증권 계좌 선택)으로 건너뛴다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 은행 미선택 상태에서 다음
    act(() => {
      result.current.goToNext();
    });

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('선택된 은행 계좌가 없습니다. 은행 단계를 건너뛰시겠습니까?')
    );
    expect(result.current.step).toBe(3);
  });

  it('Step 2 은행 상세 입력: 거래 추가, 잔액 계산 및 확정 처리 후 Step 3으로 이동', async () => {
    vi.mocked(snapshotService.calculateBank).mockResolvedValueOnce({
      theoretical_krw: 2000000,
      total_deposit: 500000,
      total_withdraw: 0,
      total_interest: 2000,
      total_tax: 300,
      existing_transactions: [],
    });

    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    act(() => {
      result.current.toggleAccountSelection(2);
    });

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.step).toBe(2);

    // 신규 거래 추가
    act(() => {
      result.current.addTx(2);
      result.current.updateTx(2, 0, 'amount', '500,000');
      result.current.updateTx(2, 0, 'type', 'DEPOSIT');
    });

    expect(result.current.accountsFormData[2].newTransactions).toHaveLength(1);

    // 은행 잔액 계산
    await act(async () => {
      await result.current.calculateBankDiff(2);
    });

    expect(snapshotService.calculateBank).toHaveBeenCalled();
    expect(result.current.accountsFormData[2].calcResult.theoretical_krw).toBe(2000000);

    // 계좌 확정
    act(() => {
      result.current.handleConfirmAccount(2);
    });

    expect(result.current.accountsFormData[2].isConfirmed).toBe(true);

    // 다음 스텝으로 이동 (선택 은행이 1개이므로 Step 3으로)
    act(() => {
      result.current.goToNext();
    });

    expect(result.current.step).toBe(3);
  });

  it('Step 3 증권 계좌 선택 및 Step 4 증권 상세 정산 후 Step 5 최종 저장 (은행 우선 전체 워크플로우)', async () => {
    vi.mocked(snapshotService.calculateBank).mockResolvedValueOnce({
      theoretical_krw: 2000000,
      total_deposit: 500000,
      total_withdraw: 0,
      total_interest: 2000,
      total_tax: 300,
      existing_transactions: [],
    });

    vi.mocked(snapshotService.calculateBrokerage).mockResolvedValueOnce({
      diff_krw: 0,
      diff_usd: 0,
      period_deposit: 1000000,
      period_profit: 50000,
      existing_transactions: [],
    });

    vi.mocked(snapshotService.saveWizardSnapshot).mockResolvedValueOnce([{ id: 101 }]);

    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 1단계: 은행 계좌(2) 선택 -> 2단계(은행 상세)
    act(() => {
      result.current.toggleAccountSelection(2);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(2);

    // 2단계: 은행 계산 및 확정 -> 3단계(증권 선택)
    await act(async () => {
      await result.current.calculateBankDiff(2);
    });
    act(() => {
      result.current.handleConfirmAccount(2);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(3);

    // 3단계: 증권 계좌(1) 선택 -> 4단계(증권 상세)
    act(() => {
      result.current.toggleAccountSelection(1);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(4);

    // 4단계: 증권 계산 및 확정 -> 5단계(최종 확인)
    await act(async () => {
      await result.current.calculateAccountDiff(1);
    });
    expect(snapshotService.calculateBrokerage).toHaveBeenCalled();

    act(() => {
      result.current.handleConfirmAccount(1);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(5);

    // 5단계: 최종 저장
    let saveResult;
    await act(async () => {
      saveResult = await result.current.handleFinalSave();
    });

    expect(snapshotService.saveWizardSnapshot).toHaveBeenCalled();
    expect(saveResult).toEqual([{ id: 101 }]);
  });

  it('이전 단계(goToPrev) 이동 및 건너뛰기 복귀가 올바르게 동작한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 1단계 -> 2단계(은행 선택 2)
    act(() => {
      result.current.toggleAccountSelection(2);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(2);

    // 2단계 -> 1단계
    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.step).toBe(1);

    // 1단계에서 은행 건너뛰기 -> 3단계
    act(() => {
      result.current.toggleAccountSelection(2); // 은행 해제
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(3);

    // 3단계(은행 미선택 상태)에서 이전 -> 1단계로 복귀
    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.step).toBe(1);

    // 3단계에서 증권 건너뛰기 -> 5단계
    act(() => {
      result.current.toggleAccountSelection(2); // 은행 선택
    });
    act(() => {
      result.current.goToNext(); // 2단계
    });
    act(() => {
      result.current.handleConfirmAccount(2);
    });
    act(() => {
      result.current.goToNext(); // 3단계
    });
    expect(result.current.step).toBe(3);

    // 증권 미선택 상태에서 다음 -> 5단계로 건너뛰기
    act(() => {
      result.current.goToNext();
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(result.current.step).toBe(5);

    // 5단계(증권 미선택 상태)에서 이전 -> 3단계로 복귀
    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.step).toBe(3);
  });

  it('출발 계좌(은행)에서 입력한 TRANSFER 거래가 도착 계좌(증권) 계산 페이로드에 자동 합산되고 selectedAccountIds는 유지된다', async () => {
    vi.mocked(snapshotService.calculateBank).mockResolvedValue({
      theoretical_krw: 2000000,
      total_deposit: 0,
      total_withdraw: 500000,
      existing_transactions: [],
    });
    vi.mocked(snapshotService.calculateBrokerage).mockResolvedValue({
      theoretical_krw: 500000,
      diff_krw: 0,
      diff_usd: 0,
      period_deposit: 500000,
      existing_transactions: [],
    });

    const { result } = renderHook(() => useSnapshotWizardEngine());
    await waitFor(() => expect(result.current.loadingAccounts).toBe(false));

    // 1단계: 은행(2번) 선택
    act(() => {
      result.current.toggleAccountSelection(2);
    });
    expect(result.current.selectedAccountIds).toEqual([2]);

    // 2단계 이동
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(2);

    // 은행 계좌에 TRANSFER 거래 추가 (target: 1번 증권 계좌)
    act(() => {
      result.current.addTx(2);
    });
    act(() => {
      result.current.updateTx(2, 0, 'type', 'TRANSFER');
      result.current.updateTx(2, 0, 'amount', '500,000');
      result.current.updateTx(2, 0, 'target_account_id', 1);
    });

    // 도착 계좌의 selectedAccountIds는 여전히 변경되지 않음
    expect(result.current.selectedAccountIds).toEqual([2]);

    // 은행 계좌 확정 및 3단계 이동
    act(() => {
      result.current.handleConfirmAccount(2);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(3);

    // 3단계: 증권(1번) 선택 후 4단계 이동
    act(() => {
      result.current.toggleAccountSelection(1);
    });
    expect(result.current.selectedAccountIds).toEqual([2, 1]);
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(4);

    // 증권 계좌 정산 계산 실행
    await act(async () => {
      await result.current.calculateAccountDiff(1);
    });

    // calculateBrokerage에 전달된 페이로드 검증: 은행에서 보낸 500,000원의 DEPOSIT이 포함되어야 함
    expect(snapshotService.calculateBrokerage).toHaveBeenCalled();
    const calledPayload = vi.mocked(snapshotService.calculateBrokerage).mock.calls[0][0];
    expect(calledPayload.account_id).toBe(1);
    expect(calledPayload.new_transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'DEPOSIT',
          total_amount: 500000,
          memo: expect.stringContaining('이체 연동'),
        }),
      ])
    );
  });

  it('TRANSFER 거래에서 도착 계좌가 미선택된 경우 계산 시 경고창을 띄우고 중단한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());
    await waitFor(() => expect(result.current.loadingAccounts).toBe(false));

    act(() => {
      result.current.toggleAccountSelection(2);
    });
    act(() => {
      result.current.goToNext();
    });

    // TRANSFER 거래 추가하되 target_account_id 미선택
    act(() => {
      result.current.addTx(2);
      result.current.updateTx(2, 0, 'type', 'TRANSFER');
      result.current.updateTx(2, 0, 'amount', '300,000');
      result.current.updateTx(2, 0, 'target_account_id', null);
    });

    await act(async () => {
      try {
        await result.current.calculateBankDiff(2);
      } catch (e) {
        // expected or caught
      }
    });

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('도착 계좌를 선택해주세요')
    );
    expect(snapshotService.calculateBank).not.toHaveBeenCalled();
  });
});
