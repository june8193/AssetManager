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
          asset_profits: [
            { asset_id: 10, ticker: '005930', asset_name: '삼성전자', country: 'KR', period_profit: 50000, current_valuation: 600000, last_valuation: 550000, period_buy: 0, period_sell: 0 },
            { asset_id: 1001, ticker: 'KRW', asset_name: '원화 예수금', country: 'KR', period_profit: 1000, current_valuation: 100000, last_valuation: 990000, period_buy: 0, period_sell: 0 }
          ]
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
    
    // 계산결과와 종목별 기간수익 상세 테이블 검증
    await waitFor(() => {
      expect(screen.getByText('+1,000원')).toBeDefined();
      expect(screen.getByText('삼성전자')).toBeDefined();
      expect(screen.getByText('+50,000원')).toBeDefined();
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
      if (url.includes('/brokerage/calculate')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ diff_krw: 500, diff_usd: 0, asset_profits: [] }) });
      if (url.includes('/bank/calculate')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ theoretical_krw: 2000000 }) });
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
    await waitFor(() => expect(screen.getByText('이 결과로 확정')).toBeDefined());
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
});
