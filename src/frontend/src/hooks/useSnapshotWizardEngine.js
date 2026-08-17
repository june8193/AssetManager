/**
 * 5단계 스냅샷 생성 위저드를 위한 딥 상태 머신 엔진 훅
 * useReducer를 기반으로 단계 전이, 계좌 선택, 거래 내역 편집, 정산 계산 및 제출을 캡슐화합니다.
 */
import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { snapshotService } from '../services/snapshotService';
import {
  buildBrokerageCalculatePayload,
  buildBankCalculatePayload,
  buildSnapshotPayload,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
} from '../utils/snapshotCalculator';

// --- 액션 타입 상수 ---
export const WIZARD_ACTIONS = {
  INIT_START: 'INIT_START',
  INIT_SUCCESS: 'INIT_SUCCESS',
  INIT_ERROR: 'INIT_ERROR',
  SET_STEP: 'SET_STEP',
  SET_CURRENT_ACC_IDX: 'SET_CURRENT_ACC_IDX',
  SET_INPUT_DATE: 'SET_INPUT_DATE',
  SET_EXCHANGE_RATE: 'SET_EXCHANGE_RATE',
  TOGGLE_ACCOUNT_SELECTION: 'TOGGLE_ACCOUNT_SELECTION',
  SET_SELECTED_ACCOUNT_IDS: 'SET_SELECTED_ACCOUNT_IDS',
  INIT_STEP_FORM_DATA: 'INIT_STEP_FORM_DATA',
  UPDATE_ACCOUNT_FORM: 'UPDATE_ACCOUNT_FORM',
  ADD_TX: 'ADD_TX',
  REMOVE_TX: 'REMOVE_TX',
  UPDATE_TX: 'UPDATE_TX',
  SET_ACCOUNT_CALC_RESULT: 'SET_ACCOUNT_CALC_RESULT',
  CONFIRM_ACCOUNT: 'CONFIRM_ACCOUNT',
  SET_PROCESSING: 'SET_PROCESSING',
  SET_LOADING_EXISTING_TXS: 'SET_LOADING_EXISTING_TXS',
  SET_EXISTING_TXS: 'SET_EXISTING_TXS',
};

// --- 초기 상태 ---
const initialState = {
  step: 1,
  totalSteps: 5,
  inputDate: new Date().toISOString().split('T')[0],
  exchangeRate: '',
  exchangeRates: [],
  accounts: [],
  selectedAccountIds: [],
  loadingAccounts: false,
  latestSnapshotDate: null,
  currentAccIdx: 0,
  accountsFormData: {},
  existingTxs: {},
  loadingExistingTxs: false,
  processing: false,
  error: null,
};

// --- 순수 리듀서 함수 ---
export function wizardReducer(state, action) {
  switch (action.type) {
    case WIZARD_ACTIONS.INIT_START:
      return { ...state, loadingAccounts: true, error: null };

    case WIZARD_ACTIONS.INIT_SUCCESS:
      return {
        ...state,
        loadingAccounts: false,
        accounts: action.payload.accounts || [],
        latestSnapshotDate: action.payload.latestSnapshotDate || null,
        exchangeRates: action.payload.exchangeRates || [],
        exchangeRate: action.payload.exchangeRate || state.exchangeRate,
      };

    case WIZARD_ACTIONS.INIT_ERROR:
      return { ...state, loadingAccounts: false, error: action.payload };

    case WIZARD_ACTIONS.SET_STEP:
      return { ...state, step: action.payload };

    case WIZARD_ACTIONS.SET_CURRENT_ACC_IDX:
      return { ...state, currentAccIdx: action.payload };

    case WIZARD_ACTIONS.SET_INPUT_DATE: {
      const newDate = action.payload;
      let matchedRate = state.exchangeRate;
      if (state.exchangeRates && state.exchangeRates.length > 0) {
        const found = state.exchangeRates.find((r) => r.date === newDate);
        if (found) {
          matchedRate = found.rate.toString();
        }
      }
      return { ...state, inputDate: newDate, exchangeRate: matchedRate };
    }

    case WIZARD_ACTIONS.SET_EXCHANGE_RATE:
      return { ...state, exchangeRate: action.payload };

    case WIZARD_ACTIONS.TOGGLE_ACCOUNT_SELECTION: {
      const id = action.payload;
      const exists = state.selectedAccountIds.includes(id);
      const newSelected = exists
        ? state.selectedAccountIds.filter((accId) => accId !== id)
        : [...state.selectedAccountIds, id];
      return { ...state, selectedAccountIds: newSelected };
    }

    case WIZARD_ACTIONS.SET_SELECTED_ACCOUNT_IDS:
      return { ...state, selectedAccountIds: action.payload };

    case WIZARD_ACTIONS.INIT_STEP_FORM_DATA: {
      const targetAccounts = action.payload || [];
      const newFormData = { ...state.accountsFormData };
      targetAccounts.forEach((acc) => {
        if (!newFormData[acc.id]) {
          newFormData[acc.id] = {
            newTransactions: [],
            existingTransactions: [],
            currentKrw: '0',
            currentUsd: '0',
            totalValuation: '0',
            calcResult: null,
            isConfirmed: false,
          };
        }
      });
      return {
        ...state,
        accountsFormData: newFormData,
        currentAccIdx: 0,
      };
    }

    case WIZARD_ACTIONS.UPDATE_ACCOUNT_FORM: {
      const { accId, updates } = action.payload;
      const current = state.accountsFormData[accId] || {
        newTransactions: [],
        existingTransactions: [],
        currentKrw: '0',
        currentUsd: '0',
        totalValuation: '0',
        calcResult: null,
        isConfirmed: false,
      };
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: {
            ...current,
            ...updates,
            isConfirmed: updates.isConfirmed !== undefined ? updates.isConfirmed : false,
          },
        },
      };
    }

    case WIZARD_ACTIONS.ADD_TX: {
      const { accId } = action.payload;
      const current = state.accountsFormData[accId] || {
        newTransactions: [],
        existingTransactions: [],
        currentKrw: '0',
        currentUsd: '0',
        totalValuation: '0',
        calcResult: null,
        isConfirmed: false,
      };
      const newTxs = [
        ...(current.newTransactions || []),
        { type: 'DEPOSIT', amount: '', currency: 'KRW', date: state.inputDate, memo: '' },
      ];
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: {
            ...current,
            newTransactions: newTxs,
            isConfirmed: false,
          },
        },
      };
    }

    case WIZARD_ACTIONS.REMOVE_TX: {
      const { accId, idx } = action.payload;
      const current = state.accountsFormData[accId] || {};
      const newTxs = (current.newTransactions || []).filter((_, i) => i !== idx);
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: {
            ...current,
            newTransactions: newTxs,
            isConfirmed: false,
          },
        },
      };
    }

    case WIZARD_ACTIONS.UPDATE_TX: {
      const { accId, idx, field, value } = action.payload;
      const current = state.accountsFormData[accId] || {};
      const newTxs = (current.newTransactions || []).map((tx, i) =>
        i === idx ? { ...tx, [field]: value } : tx
      );
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: {
            ...current,
            newTransactions: newTxs,
            isConfirmed: false,
          },
        },
      };
    }

    case WIZARD_ACTIONS.SET_ACCOUNT_CALC_RESULT: {
      const { accId, calcResult, existingTransactions } = action.payload;
      const current = state.accountsFormData[accId] || {};
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: {
            ...current,
            calcResult,
            existingTransactions: existingTransactions || current.existingTransactions || [],
          },
        },
      };
    }

    case WIZARD_ACTIONS.CONFIRM_ACCOUNT: {
      const { accId, nextIdx } = action.payload;
      const current = state.accountsFormData[accId] || {};
      return {
        ...state,
        accountsFormData: {
          ...state.accountsFormData,
          [accId]: { ...current, isConfirmed: true },
        },
        currentAccIdx: nextIdx !== undefined ? nextIdx : state.currentAccIdx,
      };
    }

    case WIZARD_ACTIONS.SET_PROCESSING:
      return { ...state, processing: action.payload };

    case WIZARD_ACTIONS.SET_LOADING_EXISTING_TXS:
      return { ...state, loadingExistingTxs: action.payload };

    case WIZARD_ACTIONS.SET_EXISTING_TXS: {
      const { accId, data } = action.payload;
      return {
        ...state,
        existingTxs: {
          ...state.existingTxs,
          [accId]: data,
        },
      };
    }

    default:
      return state;
  }
}

/**
 * 스냅샷 위저드 엔진 커스텀 훅
 */
export function useSnapshotWizardEngine() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // 계좌 필터링
  const brokerageAccounts = useMemo(
    () => state.accounts.filter((acc) => acc.is_active && acc.account_type === 'BROKERAGE'),
    [state.accounts]
  );
  const bankAccounts = useMemo(
    () => state.accounts.filter((acc) => acc.is_active && acc.account_type === 'BANK'),
    [state.accounts]
  );

  const selectedBrokerageIds = useMemo(
    () => state.selectedAccountIds.filter((id) => brokerageAccounts.some((acc) => acc.id === id)),
    [state.selectedAccountIds, brokerageAccounts]
  );
  const selectedBankIds = useMemo(
    () => state.selectedAccountIds.filter((id) => bankAccounts.some((acc) => acc.id === id)),
    [state.selectedAccountIds, bankAccounts]
  );

  // 초기 데이터 로드
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      dispatch({ type: WIZARD_ACTIONS.INIT_START });
      try {
        const data = await snapshotService.fetchWizardInitData(state.inputDate);
        if (isMounted) {
          dispatch({ type: WIZARD_ACTIONS.INIT_SUCCESS, payload: data });
        }
      } catch (err) {
        if (isMounted) {
          console.error('스냅샷 위저드 초기 데이터 로드 실패:', err);
          dispatch({ type: WIZARD_ACTIONS.INIT_ERROR, payload: err.message || '데이터 로드 실패' });
        }
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2단계 / 4단계 계좌 전환 시 기존 트랜잭션 로드
  useEffect(() => {
    const isBrokerage = state.step === 2;
    const isBank = state.step === 4;
    if (!isBrokerage && !isBank) return;

    const targetSelectedIds = isBrokerage ? selectedBrokerageIds : selectedBankIds;
    const accId = targetSelectedIds[state.currentAccIdx];
    if (!accId) return;

    let isMounted = true;
    const fetchTxs = async () => {
      dispatch({ type: WIZARD_ACTIONS.SET_LOADING_EXISTING_TXS, payload: true });
      try {
        const startDate = state.latestSnapshotDate || '1970-01-01';
        const data = await snapshotService.fetchAccountWizardData(accId, startDate, state.inputDate);
        if (isMounted) {
          dispatch({
            type: WIZARD_ACTIONS.SET_EXISTING_TXS,
            payload: { accId, data: Array.isArray(data) ? data : [] },
          });
        }
      } catch (err) {
        console.error('기존 거래 내역 로드 실패:', err);
      } finally {
        if (isMounted) {
          dispatch({ type: WIZARD_ACTIONS.SET_LOADING_EXISTING_TXS, payload: false });
        }
      }
    };

    fetchTxs();
    return () => {
      isMounted = false;
    };
  }, [state.step, state.currentAccIdx, state.inputDate, selectedBrokerageIds, selectedBankIds, state.latestSnapshotDate]);

  // 기본 정보 조작
  const setInputDate = useCallback((date) => {
    dispatch({ type: WIZARD_ACTIONS.SET_INPUT_DATE, payload: date });
  }, []);

  const setExchangeRate = useCallback((rate) => {
    dispatch({ type: WIZARD_ACTIONS.SET_EXCHANGE_RATE, payload: rate });
  }, []);

  const toggleAccountSelection = useCallback((id) => {
    dispatch({ type: WIZARD_ACTIONS.TOGGLE_ACCOUNT_SELECTION, payload: id });
  }, []);

  const selectAllBrokerage = useCallback((checked) => {
    const bIds = brokerageAccounts.map((a) => a.id);
    const newIds = checked
      ? [...new Set([...state.selectedAccountIds, ...bIds])]
      : state.selectedAccountIds.filter((id) => !bIds.includes(id));
    dispatch({ type: WIZARD_ACTIONS.SET_SELECTED_ACCOUNT_IDS, payload: newIds });
  }, [brokerageAccounts, state.selectedAccountIds]);

  const selectAllBank = useCallback((checked) => {
    const bankIds = bankAccounts.map((a) => a.id);
    const newIds = checked
      ? [...new Set([...state.selectedAccountIds, ...bankIds])]
      : state.selectedAccountIds.filter((id) => !bankIds.includes(id));
    dispatch({ type: WIZARD_ACTIONS.SET_SELECTED_ACCOUNT_IDS, payload: newIds });
  }, [bankAccounts, state.selectedAccountIds]);

  // 계좌 폼 데이터 조작
  const updateAccData = useCallback((accId, updates) => {
    dispatch({ type: WIZARD_ACTIONS.UPDATE_ACCOUNT_FORM, payload: { accId, updates } });
  }, []);

  const addTx = useCallback((accId) => {
    dispatch({ type: WIZARD_ACTIONS.ADD_TX, payload: { accId } });
  }, []);

  const removeTx = useCallback((accId, idx) => {
    dispatch({ type: WIZARD_ACTIONS.REMOVE_TX, payload: { accId, idx } });
  }, []);

  const updateTx = useCallback((accId, idx, field, value) => {
    dispatch({ type: WIZARD_ACTIONS.UPDATE_TX, payload: { accId, idx, field, value } });
  }, []);

  // 정산 계산 API 호출
  const calculateAccountDiff = useCallback(async (accId) => {
    const data = state.accountsFormData[accId] || {};
    try {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: true });
      const payload = buildBrokerageCalculatePayload({
        accountId: accId,
        snapshotDate: state.inputDate,
        newTransactions: data.newTransactions,
        currentKrw: data.currentKrw,
        currentUsd: data.currentUsd,
        exchangeRate: state.exchangeRate,
      });
      const result = await snapshotService.calculateBrokerage(payload);
      dispatch({
        type: WIZARD_ACTIONS.SET_ACCOUNT_CALC_RESULT,
        payload: {
          accId,
          calcResult: result,
          existingTransactions: result.existing_transactions || [],
        },
      });
      return result;
    } catch (err) {
      console.error('증권 계산 요청 오류:', err);
      alert('계산 중 오류가 발생했습니다.');
      throw err;
    } finally {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: false });
    }
  }, [state.accountsFormData, state.inputDate, state.exchangeRate]);

  const calculateBankDiff = useCallback(async (accId) => {
    const data = state.accountsFormData[accId] || {};
    try {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: true });
      const payload = buildBankCalculatePayload({
        accountId: accId,
        snapshotDate: state.inputDate,
        newTransactions: data.newTransactions,
      });
      const result = await snapshotService.calculateBank(payload);
      dispatch({
        type: WIZARD_ACTIONS.SET_ACCOUNT_CALC_RESULT,
        payload: {
          accId,
          calcResult: result,
          existingTransactions: result.existing_transactions || [],
        },
      });
      return result;
    } catch (err) {
      console.error('은행 계산 요청 오류:', err);
      alert('계산 중 오류가 발생했습니다.');
      throw err;
    } finally {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: false });
    }
  }, [state.accountsFormData, state.inputDate]);

  // 계좌 확정
  const handleConfirmAccount = useCallback((accId) => {
    const isBrokerage = state.step === 2;
    const targetIds = isBrokerage ? selectedBrokerageIds : selectedBankIds;
    let nextIdx = state.currentAccIdx;
    if (state.currentAccIdx < targetIds.length - 1) {
      nextIdx = state.currentAccIdx + 1;
    }
    dispatch({ type: WIZARD_ACTIONS.CONFIRM_ACCOUNT, payload: { accId, nextIdx } });
  }, [state.step, selectedBrokerageIds, selectedBankIds, state.currentAccIdx]);

  // 스텝 네비게이션
  const goToNext = useCallback(() => {
    if (state.step === 1) {
      const valid = validateStep1({ inputDate: state.inputDate, exchangeRate: state.exchangeRate });
      if (!valid.isValid) {
        alert(valid.message);
        return;
      }
      if (selectedBrokerageIds.length === 0) {
        if (window.confirm('선택된 증권 계좌가 없습니다. 증권사 단계를 건너뛰시겠습니까?')) {
          dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 3 });
          return;
        }
        return;
      }
      const selectedBrokerageAccs = brokerageAccounts.filter((a) => selectedBrokerageIds.includes(a.id));
      dispatch({ type: WIZARD_ACTIONS.INIT_STEP_FORM_DATA, payload: selectedBrokerageAccs });
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 2 });
      return;
    }

    if (state.step === 2) {
      const valid = validateStep2({
        currentAccIdx: state.currentAccIdx,
        selectedBrokerageIds,
        accountsFormData: state.accountsFormData,
      });
      if (!valid.isValid) {
        alert(valid.message);
        return;
      }
      if (state.currentAccIdx < selectedBrokerageIds.length - 1) {
        dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: state.currentAccIdx + 1 });
        return;
      }
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 3 });
      return;
    }

    if (state.step === 3) {
      const valid = validateStep3({ selectedBrokerageIds, selectedBankIds });
      if (!valid.isValid) {
        alert(valid.message);
        return;
      }
      if (selectedBankIds.length === 0) {
        if (window.confirm('선택된 은행 계좌가 없습니다. 바로 최종 확인으로 이동하시겠습니까?')) {
          dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 5 });
          return;
        }
        return;
      }
      const selectedBankAccs = bankAccounts.filter((a) => selectedBankIds.includes(a.id));
      dispatch({ type: WIZARD_ACTIONS.INIT_STEP_FORM_DATA, payload: selectedBankAccs });
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 4 });
      return;
    }

    if (state.step === 4) {
      const valid = validateStep4({
        currentAccIdx: state.currentAccIdx,
        selectedBankIds,
        accountsFormData: state.accountsFormData,
      });
      if (!valid.isValid) {
        alert(valid.message);
        return;
      }
      if (state.currentAccIdx < selectedBankIds.length - 1) {
        dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: state.currentAccIdx + 1 });
        return;
      }
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 5 });
      return;
    }
  }, [state.step, state.inputDate, state.exchangeRate, selectedBrokerageIds, selectedBankIds, brokerageAccounts, bankAccounts, state.currentAccIdx, state.accountsFormData]);

  const goToPrev = useCallback(() => {
    if (state.step === 2 || state.step === 4) {
      if (state.currentAccIdx > 0) {
        dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: state.currentAccIdx - 1 });
        return;
      }
    }

    if (state.step === 3) {
      if (selectedBrokerageIds.length === 0) {
        dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 1 });
        return;
      }
      dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: selectedBrokerageIds.length - 1 });
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 2 });
      return;
    }

    if (state.step === 5) {
      if (selectedBankIds.length === 0) {
        dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 3 });
        return;
      }
      dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: selectedBankIds.length - 1 });
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: 4 });
      return;
    }

    if (state.step > 1) {
      dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: state.step - 1 });
    }
  }, [state.step, state.currentAccIdx, selectedBrokerageIds, selectedBankIds]);

  const setStep = useCallback((targetStep) => {
    dispatch({ type: WIZARD_ACTIONS.SET_STEP, payload: targetStep });
  }, []);

  const setCurrentAccIdx = useCallback((idx) => {
    dispatch({ type: WIZARD_ACTIONS.SET_CURRENT_ACC_IDX, payload: idx });
  }, []);

  // 최종 저장
  const handleFinalSave = useCallback(async () => {
    const valid = validateStep5({
      selectedAccountIds: state.selectedAccountIds,
      accountsFormData: state.accountsFormData,
    });
    if (!valid.isValid) {
      alert(valid.message);
      return;
    }

    try {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: true });
      const payload = buildSnapshotPayload({
        snapshotDate: state.inputDate,
        exchangeRate: state.exchangeRate,
        brokerageAccountIds: selectedBrokerageIds,
        bankAccountIds: selectedBankIds,
        accountsFormData: state.accountsFormData,
      });

      const response = await snapshotService.saveWizardSnapshot(payload);
      return response;
    } catch (err) {
      console.error('최종 저장 오류:', err);
      alert(`저장 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
      throw err;
    } finally {
      dispatch({ type: WIZARD_ACTIONS.SET_PROCESSING, payload: false });
    }
  }, [state.selectedAccountIds, state.accountsFormData, state.inputDate, state.exchangeRate, selectedBrokerageIds, selectedBankIds]);

  return {
    ...state,
    brokerageAccounts,
    bankAccounts,
    selectedBrokerageIds,
    selectedBankIds,
    setInputDate,
    setExchangeRate,
    toggleAccountSelection,
    selectAllBrokerage,
    selectAllBank,
    updateAccData,
    addTx,
    removeTx,
    updateTx,
    calculateAccountDiff,
    calculateBankDiff,
    handleConfirmAccount,
    goToNext,
    goToPrev,
    setStep,
    setCurrentAccIdx,
    handleFinalSave,
  };
}
