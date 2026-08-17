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

describe('useSnapshotWizardEngine 훅 테스트', () => {
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

  it('계좌 선택 토글 및 전체 선택/해제가 동작한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 개별 토글
    act(() => {
      result.current.toggleAccountSelection(1);
    });
    expect(result.current.selectedAccountIds).toContain(1);

    act(() => {
      result.current.toggleAccountSelection(1);
    });
    expect(result.current.selectedAccountIds).not.toContain(1);

    // 증권 계좌 전체 선택
    act(() => {
      result.current.selectAllBrokerage(true);
    });
    expect(result.current.selectedAccountIds).toContain(1);

    // 증권 계좌 전체 해제
    act(() => {
      result.current.selectAllBrokerage(false);
    });
    expect(result.current.selectedAccountIds).not.toContain(1);
  });

  it('Step 1에서 유효성 검사 통과 후 Step 2로 전이한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    act(() => {
      result.current.toggleAccountSelection(1);
    });

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.step).toBe(2);
    expect(result.current.currentAccIdx).toBe(0);
    expect(result.current.accountsFormData[1]).toBeDefined();
    expect(result.current.accountsFormData[1].currentKrw).toBe('0');
  });

  it('Step 2 증권사 상세 입력: 신규 거래 추가, 잔액 수정, 정산 계산 및 확정 처리', async () => {
    vi.mocked(snapshotService.calculateBrokerage).mockResolvedValueOnce({
      diff_krw: 5000,
      diff_usd: 0,
      period_deposit: 1000000,
      period_profit: 50000,
      existing_transactions: [],
    });

    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    act(() => {
      result.current.toggleAccountSelection(1);
    });

    act(() => {
      result.current.goToNext();
    });

    // 신규 거래 추가 및 수정
    act(() => {
      result.current.addTx(1);
      result.current.updateTx(1, 0, 'amount', '500,000');
      result.current.updateTx(1, 0, 'type', 'DEPOSIT');
      result.current.updateAccData(1, { currentKrw: '1,500,000' });
    });

    expect(result.current.accountsFormData[1].newTransactions).toHaveLength(1);
    expect(result.current.accountsFormData[1].currentKrw).toBe('1,500,000');

    // 정산 계산
    await act(async () => {
      await result.current.calculateAccountDiff(1);
    });

    expect(snapshotService.calculateBrokerage).toHaveBeenCalled();
    expect(result.current.accountsFormData[1].calcResult.diff_krw).toBe(5000);

    // 계좌 확정
    act(() => {
      result.current.handleConfirmAccount(1);
    });

    expect(result.current.accountsFormData[1].isConfirmed).toBe(true);

    // 다음 스텝으로 이동 (증권이 1개이므로 Step 3으로)
    act(() => {
      result.current.goToNext();
    });

    expect(result.current.step).toBe(3);
  });

  it('Step 3 은행 선택 및 Step 4 은행 상세 정산 후 Step 5 최종 저장', async () => {
    vi.mocked(snapshotService.calculateBank).mockResolvedValueOnce({
      theoretical_krw: 2000000,
      total_deposit: 500000,
      total_withdraw: 0,
      total_interest: 2000,
      total_tax: 300,
      existing_transactions: [],
    });

    vi.mocked(snapshotService.saveWizardSnapshot).mockResolvedValueOnce([{ id: 101 }]);

    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 1단계 -> 2단계
    act(() => {
      result.current.toggleAccountSelection(1);
    });
    act(() => {
      result.current.goToNext();
    });

    // 2단계 확정 -> 3단계
    act(() => {
      result.current.handleConfirmAccount(1);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(3);

    // 3단계: 은행 계좌 선택 -> 4단계
    act(() => {
      result.current.toggleAccountSelection(2);
    });
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.step).toBe(4);

    // 4단계: 은행 계산 및 확정
    await act(async () => {
      await result.current.calculateBankDiff(2);
    });
    expect(snapshotService.calculateBank).toHaveBeenCalled();

    act(() => {
      result.current.handleConfirmAccount(2);
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

  it('이전 단계(goToPrev) 이동이 올바르게 동작한다', async () => {
    const { result } = renderHook(() => useSnapshotWizardEngine());

    await waitFor(() => {
      expect(result.current.loadingAccounts).toBe(false);
    });

    // 1단계 -> 2단계
    act(() => {
      result.current.toggleAccountSelection(1);
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
  });
});
