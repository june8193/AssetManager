import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import SnapshotWizardPage from './SnapshotWizardPage';

// window.confirm 모킹
window.confirm = vi.fn();
// window.alert 모킹
window.alert = vi.fn();

// fetch 모킹
global.fetch = vi.fn();

const renderWithRouter = (ui) => {
  return render(ui, { wrapper: BrowserRouter });
};

const mockAccounts = [
  { id: 1, name: '증권 계좌 1', provider: '미래에셋', account_type: 'BROKERAGE', is_active: true, user_name: '홍길동', alias: 'KB증권별칭' },
  { id: 2, name: '은행 계좌 1', provider: '국민은행', account_type: 'BANK', is_active: true, user_name: '홍길동', alias: '국민은행별칭' }
];

describe('SnapshotWizardPage (Unified 5-Step)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAccounts)
    });
    window.confirm.mockReturnValue(true);
  });

  it('초기 렌더링 시 1단계(기본 정보 및 증권 계좌 선택)가 표시된다', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    expect(screen.getByText('신규 스냅샷 생성')).toBeDefined();
    expect(screen.getByText('기본 정보 및 증권 계좌 선택')).toBeDefined();
    
    // 계좌 로드 대기
    await waitFor(() => {
      // 별칭이 계좌명과 결합되어 올바르게 표시되는지 검증
      expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined();
      // 은행 계좌는 1단계에 나오지 않아야 함
      expect(screen.queryByText('은행 계좌 1 (국민은행별칭)')).toBeNull();
    });
  });

  it('1단계에서 필수 정보 미입력 시 다음 단계로 이동 불가', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());

    const nextButton = screen.getByRole('button', { name: /다음/i });
    fireEvent.click(nextButton);

    expect(window.alert).toHaveBeenCalledWith('올바른 환율을 입력해주세요.');
  });

  it('증권 계좌 선택 없이 진행 시 건너뛰기 확인 창이 뜬다', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());

    // 환율 입력
    const rateInput = screen.getByPlaceholderText(/예: 1350.5/);
    fireEvent.change(rateInput, { target: { value: '1350' } });

    const nextButton = screen.getByRole('button', { name: /다음/i });
    fireEvent.click(nextButton);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('증권사 단계를 건너뛰시겠습니까'));
  });

  it('증권 계좌 정산 후 은행 계좌 선택 단계로 이동한다', async () => {
    // Mock for calculation
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      }
      if (url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([
          { id: 101, transaction_date: '2026-05-20', type: 'BUY', total_amount: 500000, currency: 'KRW', memo: '기존거래' }
        ]) });
      }
      if (url.includes('/calculate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ 
          diff_krw: 1000, 
          diff_usd: 0, 
          existing_transactions: [],
          period_deposit: 500000,
          period_profit: 1000
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());

    // 1단계 입력
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('증권 계좌 1 (KB증권별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // 2단계: 증권 상세 입력
    expect(screen.getByText('증권사 상세 정보 입력')).toBeDefined();
    
    // 기존 트랜잭션이 불러와져 화면에 표시되는지 검증
    await waitFor(() => {
      expect(screen.getByText('기존거래')).toBeDefined();
    });

    // 계산 버튼 클릭
    fireEvent.click(screen.getByText('정산 결과 계산하기'));
    
    // 계산결과 검증
    await waitFor(() => {
      expect(screen.getByText('+1,000원')).toBeDefined();
    });

    // 확정 버튼 클릭
    fireEvent.click(screen.getByText('이 결과로 확정'));

    // 다음 버튼 클릭 (Step 3로 이동)
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // 3단계: 은행 계좌 선택
    expect(screen.getByRole('heading', { name: '은행 계좌 선택', level: 2 })).toBeDefined();
    expect(screen.getByText('은행 계좌 1 (국민은행별칭)')).toBeDefined();
  });

  it('통합 저장 프로세스 검증 (증권1 + 은행1)', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.includes('/transactions/period')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/brokerage/calculate')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ diff_krw: 500, diff_usd: 0, period_deposit: 0, period_profit: 0 }) });
      if (url.includes('/bank/calculate')) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        theoretical_krw: 2000000,
        total_deposit: 2000000,
        total_withdraw: 100000,
        total_interest: 5000,
        total_tax: 700,
        total_fee: 0,
        total_adjustment: 0
      }) });
      if (url.includes('/unified/save')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithRouter(<SnapshotWizardPage />);
    
    // Step 1
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('증권 계좌 1 (KB증권별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // Step 2
    fireEvent.click(screen.getByText('정산 결과 계산하기'));
    await waitFor(() => expect(screen.getByText('이 결과로 확정')).toBeDefined());
    fireEvent.click(screen.getByText('이 결과로 확정'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // Step 3
    expect(screen.getByRole('heading', { name: '은행 계좌 선택', level: 2 })).toBeDefined();
    fireEvent.click(screen.getByText('은행 계좌 1 (국민은행별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // Step 4
    expect(screen.getByText('은행 상세 정보 입력')).toBeDefined();
    fireEvent.click(screen.getByText('예상 잔액 계산하기'));
    
    await waitFor(() => {
      expect(screen.getByText('이 결과로 확정')).toBeDefined();
      // 은행 집계 데이터 렌더링 검증 (시스템 예상 잔액 및 기간 총 입금 둘 다 2,000,000원 표시됨)
      expect(screen.getAllByText('2,000,000원').length).toBe(2);
      expect(screen.getByText('100,000원')).toBeDefined();
      expect(screen.getByText('+5,000원')).toBeDefined();
      expect(screen.getByText('-700원')).toBeDefined();
    });
    
    fireEvent.click(screen.getByText('이 결과로 확정'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // Step 5
    expect(screen.getByText('최종 확인')).toBeDefined();
    expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined();
    expect(screen.getByText('은행 계좌 1 (국민은행별칭)')).toBeDefined();

    const saveButton = screen.getByRole('button', { name: /저장하기/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/unified/save'), expect.any(Object));
      expect(window.alert).toHaveBeenCalledWith('스냅샷이 성공적으로 저장되었습니다.');
    });
  });

  it('증권사 상세 입력 화면에서 가로 분할(grid-cols-3) 대신 세로 배치 레이아웃(space-y-8)이 적용된다', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      }
      if (url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([
          { id: 101, transaction_date: '2026-05-20', type: 'BUY', total_amount: 500000, currency: 'KRW', memo: '기존거래' }
        ]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { container } = renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('증권 계좌 1 (KB증권별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    await waitFor(() => expect(screen.getByText('증권사 상세 정보 입력')).toBeDefined());
    
    // space-y-8 클래스를 가진 엘리먼트가 존재하고, 가로 분할용 grid-cols-3는 존재하지 않아야 함
    const spaceYDiv = container.querySelector('.space-y-8');
    expect(spaceYDiv).toBeInTheDocument();
    
    const gridDiv = container.querySelector('.grid-cols-3');
    expect(gridDiv).toBeNull();
  });

  it('금액 입력 필드에 숫자를 입력하면 천단위 쉼표가 자동으로 적용된다', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.includes('/transactions/period')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('증권 계좌 1 (KB증권별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    await waitFor(() => expect(screen.getByText('증권사 상세 정보 입력')).toBeDefined());

    // 원화 잔액 입력 필드 조회 (id="current-krw"로 수정될 예정이므로 getById 등으로 찾거나, element가 렌더링되는 div를 탐색)
    // 여기서는 getByLabelText로 찾을 수 있도록 돕기 위해 label에 htmlFor가 달릴 것을 가정하고 getByLabelText(/원화 잔액/i)를 유지합니다.
    const krwInput = screen.getByLabelText(/원화 잔액/i);
    expect(krwInput).toBeDefined();

    // 1000000 입력 시 1,000,000으로 포맷팅되는지 검증
    fireEvent.change(krwInput, { target: { value: '1000000' } });
    expect(krwInput.value).toBe('1,000,000');
  });

  it('증권사 상세 입력 단계에서 정산 확정 시 입력 폼이 숨겨지고 요약 정보와 수정하기 버튼이 나타나며, 수정하기 클릭 시 다시 폼이 나타난다', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      }
      if (url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/brokerage/calculate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ 
          diff_krw: 10000, 
          diff_usd: 10, 
          existing_transactions: [],
          asset_profits: []
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithRouter(<SnapshotWizardPage />);
    
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('증권 계좌 1 (KB증권별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    await waitFor(() => expect(screen.getByText('증권사 상세 정보 입력')).toBeDefined());

    // 잔고 입력 필드가 화면에 보이는지 확인
    expect(screen.getByLabelText(/원화 잔액/i)).toBeInTheDocument();
    
    // 계산 실행
    fireEvent.click(screen.getByText('정산 결과 계산하기'));
    await waitFor(() => expect(screen.getByText('이 결과로 확정')).toBeInTheDocument());
    
    // 확정 클릭
    fireEvent.click(screen.getByText('이 결과로 확정'));

    // 확정 후: 입력 폼이 숨겨져야 함
    await waitFor(() => {
      expect(screen.queryByLabelText(/원화 잔액/i)).toBeNull();
      expect(screen.queryByText('정산 결과 계산하기')).toBeNull();
      // 대신 요약 카드와 수정하기 버튼이 보여야 함
      expect(screen.getByText('정산 결과 확정 완료')).toBeInTheDocument();
      expect(screen.getByText('수정하기')).toBeInTheDocument();
    });

    // 수정하기 클릭
    fireEvent.click(screen.getByText('수정하기'));

    // 다시 입력 폼이 보여야 함
    await waitFor(() => {
      expect(screen.getByLabelText(/원화 잔액/i)).toBeInTheDocument();
      expect(screen.getByText('정산 결과 계산하기')).toBeInTheDocument();
      expect(screen.queryByText('정산 결과 확정 완료')).toBeNull();
    });
  });

  it('은행 상세 입력 단계에서 정산 확정 시 입력 폼이 숨겨지고 요약 정보와 수정하기 버튼이 나타나며, 수정하기 클릭 시 다시 폼이 나타난다', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/accounts') && !url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      }
      if (url.includes('/transactions/period')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/bank/calculate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          theoretical_krw: 500000,
          total_deposit: 500000,
          total_withdraw: 0,
          total_interest: 0,
          total_tax: 0,
          total_fee: 0,
          total_adjustment: 0
        }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithRouter(<SnapshotWizardPage />);
    
    // Step 1
    await waitFor(() => expect(screen.getByText('증권 계좌 1 (KB증권별칭)')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText(/예: 1350.5/), { target: { value: '1350' } });
    // 은행 계좌만 선택하고 증권은 건너뜀
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    // confirm 모킹 때문에 증권 건너뛰기가 승인됨
    
    // Step 3 (은행 선택)
    await waitFor(() => expect(screen.getByRole('heading', { name: '은행 계좌 선택', level: 2 })).toBeDefined());
    fireEvent.click(screen.getByText('은행 계좌 1 (국민은행별칭)'));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));

    // Step 4 (은행 상세)
    await waitFor(() => expect(screen.getByText('은행 상세 정보 입력')).toBeDefined());

    // 예상 잔액 계산 전: 실제 최종 잔액 필드가 보임
    expect(screen.getByLabelText(/실제 최종 잔액/i)).toBeInTheDocument();

    // 계산 및 확정
    fireEvent.click(screen.getByText('예상 잔액 계산하기'));
    await waitFor(() => expect(screen.getByText('이 결과로 확정')).toBeInTheDocument());
    fireEvent.click(screen.getByText('이 결과로 확정'));

    // 확정 후: 입력 폼이 숨겨져야 함
    await waitFor(() => {
      expect(screen.queryByLabelText(/실제 최종 잔액/i)).toBeNull();
      expect(screen.queryByText('예상 잔액 계산하기')).toBeNull();
      expect(screen.getByText('정산 결과 확정 완료')).toBeInTheDocument();
      expect(screen.getByText('수정하기')).toBeInTheDocument();
    });

    // 수정하기 클릭
    fireEvent.click(screen.getByText('수정하기'));

    // 다시 입력 폼이 보여야 함
    await waitFor(() => {
      expect(screen.getByLabelText(/실제 최종 잔액/i)).toBeInTheDocument();
      expect(screen.getByText('예상 잔액 계산하기')).toBeInTheDocument();
      expect(screen.queryByText('정산 결과 확정 완료')).toBeNull();
    });
  });
});
