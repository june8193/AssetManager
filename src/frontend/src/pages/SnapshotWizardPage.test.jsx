import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import SnapshotWizardPage from './SnapshotWizardPage';

// window.confirm 모킹
window.confirm = vi.fn();

// fetch 모킹
global.fetch = vi.fn();

const renderWithRouter = (ui) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe('SnapshotWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: '테스트 계좌', provider: '테스트 증권', account_type: 'BROKERAGE', is_active: true, user_name: '홍길동' }
      ])
    });
  });

  it('초기 렌더링 시 1단계(유형 선택)가 표시된다', () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    expect(screen.getByText('신규 스냅샷 생성')).toBeDefined();
    expect(screen.getByText('스냅샷 유형을 선택하세요')).toBeDefined();
    expect(screen.getByText('증권사')).toBeDefined();
    expect(screen.getByText('은행')).toBeDefined();
  });

  it('유형 선택 시 2단계로 이동한다', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    // 증권사 버튼 클릭
    const brokerageButton = screen.getByText('증권사');
    fireEvent.click(brokerageButton);
    
    // 2단계 제목 확인
    expect(screen.getByText('기본 설정 및 계좌 선택')).toBeDefined();
    // 상단 인디케이터의 '계좌 선택' 텍스트 확인
    expect(screen.getAllByText('계좌 선택')).toBeDefined();
  });

  it('이전 버튼 클릭 시 이전 단계로 돌아간다', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    // 1단계 -> 2단계
    fireEvent.click(screen.getByText('증권사'));
    expect(screen.getByText('기본 설정 및 계좌 선택')).toBeDefined();
    
    // 2단계 -> 1단계
    const prevButton = screen.getByRole('button', { name: /이전/i });
    fireEvent.click(prevButton);
    expect(screen.getByText('스냅샷 유형을 선택하세요')).toBeDefined();
  });

  it('취소 버튼 클릭 시 확인 창이 뜬다', () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    const cancelButton = screen.getByText('취소');
    fireEvent.click(cancelButton);
    
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('취소하시겠습니까'));
  });

  it('2단계에서 계좌 선택 후 다음 클릭 시 3단계로 이동한다', async () => {
    renderWithRouter(<SnapshotWizardPage />);
    
    // 1단계 -> 2단계
    fireEvent.click(screen.getByText('증권사'));
    
    // 계좌가 로드될 때까지 대기
    await waitFor(() => {
      expect(screen.getByText('테스트 계좌')).toBeDefined();
    });

    // 환율 입력
    const exchangeRateInput = screen.getByPlaceholderText(/예: 1350.5/);
    fireEvent.change(exchangeRateInput, { target: { value: '1350' } });

    // 계좌 선택 (테이블 행 클릭)
    const accountRow = screen.getByText('테스트 계좌').closest('tr');
    fireEvent.click(accountRow);

    // 다음 버튼 클릭
    const nextButton = screen.getByRole('button', { name: /다음/i });
    fireEvent.click(nextButton);

    // 3단계 제목 확인
    expect(screen.getByText('상세 정보 입력')).toBeDefined();
    // 3단계 상단 '1 / 1 계좌' 텍스트 확인 (split 되어 있으므로 부분 텍스트로 확인)
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('/')).toBeDefined();
    expect(screen.getByText(/1 계좌/)).toBeDefined();
    expect(screen.getByText('테스트 계좌')).toBeDefined();
  });
});
