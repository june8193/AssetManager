import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllocationStudioPage from './AllocationStudioPage';

// Recharts ResponsiveContainer Mocking (테스트 환경에서 크기 에러 방지)
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: '800px', height: '400px' }}>{children}</div>
    ),
  };
});

const mockSuccessResponse = {
  cagr: 15.4,
  mdd: 12.5,
  strategy_returns: [0.0, 5.2, 15.4],
  benchmark_returns: [0.0, 3.1, 10.2],
  dates: ["2026-05-01", "2026-05-02", "2026-05-03"],
  today_recommendation: {
    recommended_stock_weight: 90.0,
    recommended_cash_weight: 10.0,
    current_score: 3,
    score_breakdown: {
      trend_pass: true,
      momentum_pass: true,
      vix_stable: true,
      trend_val: 105.0,
      ma_val: 100.0,
      past_val: 95.0,
      vix_val: 15.0
    }
  }
};

describe('AllocationStudioPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
  });

  it('기본 설정 패널 및 설명 텍스트를 렌더링한다', async () => {
    render(<AllocationStudioPage />);

    // 최초 자동 백테스트 결과가 올 때까지 대기
    await screen.findByText('15.4%');

    expect(screen.getByText('자산배분 스튜디오')).toBeDefined();
    expect(screen.getByText('전략 파라미터 설정')).toBeDefined();
    expect(screen.getByText('대상 지수 (Target Index)')).toBeDefined();
    expect(screen.getByText('리밸런싱 주기')).toBeDefined();
  });

  it('백테스트 실행 버튼 클릭 시 fetch를 호출하고 결과를 화면에 표시한다', async () => {
    render(<AllocationStudioPage />);

    // 최초 자동 백테스트 결과 대기
    await screen.findByText('15.4%');

    const runButton = screen.getByRole('button', { name: /시뮬레이션 실행/i });
    expect(runButton).toBeDefined();

    fireEvent.click(runButton);

    // 다시 로드되어 결과가 표시될 때까지 대기 (cagr 15.4% 확인)
    const cagrText = await screen.findByText('15.4%');
    expect(cagrText).toBeDefined();

    // MDD 결과 표시 확인
    expect(screen.getByText('-12.5%')).toBeDefined();
    // 추천 비중 및 스코어 표시 확인
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('/ 3점')).toBeDefined();
    expect(screen.getByText('주식 ETF: 90%')).toBeDefined();

    // fetch가 요청 정보를 담아 POST로 전달되었는지 검증
    expect(global.fetch).toHaveBeenCalledWith('/api/allocation/backtest', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"target_index":"S&P500"')
    }));
  });

  it('한국 지수(KOSPI)를 선택하면 VIX 지수 사용 안내 경고창이 활성화된다', async () => {
    render(<AllocationStudioPage />);

    // 최초 결과 대기
    await screen.findByText('15.4%');

    // KOSPI 지수 선택
    const selectEl = screen.getByLabelText(/대상 지수/i);
    fireEvent.change(selectEl, { target: { value: 'KOSPI' } });

    // 안내문구가 뜰 때까지 대기
    await screen.findByText(/알림: 변동성 지수\(VIX\) 일괄 적용 안내/i);
  });
});
