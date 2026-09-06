import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketAnalysisPage from './MarketAnalysisPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// fetch API 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockHistoricalData = {
  labels: ["2026-06-01", "2026-06-02", "2026-06-03"],
  prices: [5100.0, 5150.0, 5120.0],
  mdd: [0.0, 0.0, -0.58],
  vix: [15.2, 14.8, 16.1]
};

const mockStatsData = {
  yearly: [
    {
      year: 2026,
      close_price: 5120.0,
      return_rate: 8.5,
      mdd: -3.5
    }
  ],
  monthly: [
    {
      year: 2026,
      month: 6,
      close_price: 5120.0,
      return_rate: 1.2,
      mdd: -1.5
    }
  ]
};

const mockComparisonData = [
  {
    year: 2026,
    kospi: 5.4,
    kosdaq: 3.2,
    sp500: 8.5,
    nasdaq: 12.1
  },
  {
    year: 2025,
    kospi: -2.1,
    kosdaq: 1.5,
    sp500: 15.2,
    nasdaq: 22.0
  }
];

describe('MarketAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 기본 API 호출 응답 모킹
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/market/analysis/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockHistoricalData),
        });
      }
      if (url.includes('/api/market/analysis/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        });
      }
      if (url.includes('/api/market/analysis/comparison')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockComparisonData),
        });
      }
      return Promise.reject(new Error('Unknown API endpoint'));
    });
  });

  it('기본적으로 "지수별 상세 분석" 탭과 기본 차트/테이블이 정상적으로 로드되는지 확인한다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    // 타이틀 확인
    expect(screen.getByText('지수분석')).toBeDefined();

    // 탭 이름 확인
    expect(screen.getByText('지수별 상세 분석')).toBeDefined();
    expect(screen.getByText('4대 지수 연간 수익률 비교')).toBeDefined();

    // 로딩이 끝날 때까지 대기
    await waitFor(() => {
      expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
    });

    // 기본 지수 KOSPI, KOSDAQ, S&P 500, NASDAQ 버튼이 있는지 확인
    expect(screen.getByRole('button', { name: /S&P 500/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /KOSPI/i })).toBeDefined();

    // 지수 데이터 테이블 렌더링 검증 (기본 월별 탭 상태 검증)
    expect(screen.getByText(/2026년 6월/)).toBeDefined();
    expect(screen.getByText('+1.20%')).toBeDefined();
    expect(screen.getByText('-1.50%')).toBeDefined();
  });

  it('탭을 클릭하면 "4대 지수 연간 수익률 비교" 화면으로 전환된다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    const compTab = screen.getByText('4대 지수 연간 수익률 비교');
    fireEvent.click(compTab);

    // 테이블 헤더 및 데이터 렌더링 검증
    await waitFor(() => {
      expect(screen.getByText('연도별 지수 수익률 비교')).toBeDefined();
      expect(screen.getByText('2025')).toBeDefined();
      // KOSPI 2025년 수익률 -2.10% 확인
      expect(screen.getByText('-2.10%')).toBeDefined();
      // S&P 500 2025년 수익률 +15.20% 확인
      expect(screen.getByText('+15.20%')).toBeDefined();
    });
  });

  it('MDD 차트 하단에 VIX 변동성 지수(S&P 500) 차트와 최근 VIX 수치가 렌더링된다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
    });

    // VIX 변동성 지수 타이틀 렌더링 확인
    expect(screen.getByText(/VIX 변동성 지수 \(S&P 500\)/)).toBeDefined();

    // 최근 VIX 값 렌더링 확인 (mockHistoricalData의 마지막 값: 16.1 -> 16.10)
    expect(screen.getByText('16.10')).toBeDefined();
  });

  it('VIX 수치에 따라 4단계 상태 배지(안정/주의/경고/위기)가 올바른 텍스트와 색상으로 렌더링된다', async () => {
    // 1) 20 미만: 안정 (#10B981) - mockHistoricalData.vix[2] = 16.1
    const { unmount } = render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
    });

    const stableBadge = screen.getByTestId('vix-status-badge');
    expect(stableBadge).toBeDefined();
    expect(stableBadge.textContent).toBe('안정');
    unmount();

    // 2) 20 이상 30 미만: 주의 (#F59E0B)
    mockFetch.mockImplementationOnce((url) => {
      if (url.includes('/api/market/analysis/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockHistoricalData, vix: [20.0, 22.5, 25.4] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStatsData) });
    });

    const renderCaution = render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('25.40')).toBeDefined();
    });
    const cautionBadge = screen.getByTestId('vix-status-badge');
    expect(cautionBadge.textContent).toBe('주의');
    renderCaution.unmount();

    // 3) 30 이상 40 미만: 경고 (#EF4444)
    mockFetch.mockImplementationOnce((url) => {
      if (url.includes('/api/market/analysis/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockHistoricalData, vix: [25.0, 31.0, 35.8] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStatsData) });
    });

    const renderWarning = render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('35.80')).toBeDefined();
    });
    const warningBadge = screen.getByTestId('vix-status-badge');
    expect(warningBadge.textContent).toBe('경고');
    renderWarning.unmount();

    // 4) 40 이상: 위기 (#991B1B)
    mockFetch.mockImplementationOnce((url) => {
      if (url.includes('/api/market/analysis/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockHistoricalData, vix: [35.0, 42.0, 48.5] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStatsData) });
    });

    const renderCrisis = render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('48.50')).toBeDefined();
    });
    const crisisBadge = screen.getByTestId('vix-status-badge');
    expect(crisisBadge.textContent).toBe('위기');
    renderCrisis.unmount();
  });

  it('VIX 차트에 20(주의), 30(경고), 40(위기) 기준선(ReferenceLine) 라벨이 렌더링된다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
    });

    // ReferenceLine 라벨 텍스트 존재 확인
    expect(screen.getByText(/주의 20/)).toBeDefined();
    expect(screen.getByText(/경고 30/)).toBeDefined();
    expect(screen.getByText(/위기 40/)).toBeDefined();
  });

  describe('getVixStatus 헬퍼 함수 경계값 검증', () => {
    it('null, undefined, NaN 입력 시 null을 반환한다', async () => {
      const { getVixStatus } = await import('./MarketAnalysisPage');
      expect(getVixStatus(null)).toBeNull();
      expect(getVixStatus(undefined)).toBeNull();
      expect(getVixStatus(NaN)).toBeNull();
    });

    it('20 미만은 안정 상태(Green #10B981)를 반환한다', async () => {
      const { getVixStatus } = await import('./MarketAnalysisPage');
      const status = getVixStatus(19.99);
      expect(status.level).toBe('stable');
      expect(status.label).toBe('안정');
      expect(status.color).toBe('#10B981');
    });

    it('20 이상 30 미만은 주의 상태(Amber #F59E0B)를 반환한다', async () => {
      const { getVixStatus } = await import('./MarketAnalysisPage');
      const status20 = getVixStatus(20.0);
      expect(status20.level).toBe('caution');
      expect(status20.label).toBe('주의');
      expect(status20.color).toBe('#F59E0B');

      const status29 = getVixStatus(29.99);
      expect(status29.level).toBe('caution');
      expect(status29.label).toBe('주의');
    });

    it('30 이상 40 미만은 경고 상태(Red #EF4444)를 반환한다', async () => {
      const { getVixStatus } = await import('./MarketAnalysisPage');
      const status30 = getVixStatus(30.0);
      expect(status30.level).toBe('warning');
      expect(status30.label).toBe('경고');
      expect(status30.color).toBe('#EF4444');

      const status39 = getVixStatus(39.99);
      expect(status39.level).toBe('warning');
      expect(status39.label).toBe('경고');
    });

    it('40 이상은 위기 상태(Deep Crimson #991B1B)를 반환한다', async () => {
      const { getVixStatus } = await import('./MarketAnalysisPage');
      const status40 = getVixStatus(40.0);
      expect(status40.level).toBe('crisis');
      expect(status40.label).toBe('위기');
      expect(status40.color).toBe('#991B1B');

      const status80 = getVixStatus(80.5);
      expect(status80.level).toBe('crisis');
      expect(status80.label).toBe('위기');
    });
  });

  describe('VIX Info 안내 팝오버 인터랙션 검증', () => {
    it('VIX 차트 타이틀 옆에 Info 안내 아이콘 버튼이 렌더링된다', async () => {
      render(
        <MaskingProvider>
          <MarketAnalysisPage />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
      });

      const infoButton = screen.getByTestId('vix-info-button');
      expect(infoButton).toBeDefined();
      expect(infoButton.getAttribute('aria-label')).toBe('VIX 지표 안내');
    });

    it('Info 아이콘 마우스 호버 시 VIX 개념 및 4단계 기준선 안내 팝오버가 표시되고 마우스 아웃 시 닫힌다', async () => {
      render(
        <MaskingProvider>
          <MarketAnalysisPage />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
      });

      const infoContainer = screen.getByTestId('vix-info-container');
      
      // 초기에는 팝오버가 보이지 않음
      expect(screen.queryByTestId('vix-info-popover')).toBeNull();

      // 마우스 진입 시 팝오버 표시
      fireEvent.mouseEnter(infoContainer);
      const popover = screen.getByTestId('vix-info-popover');
      expect(popover).toBeDefined();
      
      // VIX 개념 및 기준선 텍스트 검증
      expect(screen.getByText(/CBOE S&P 500 변동성 지수/)).toBeDefined();
      expect(screen.getByText(/안정 \(20 미만\)/)).toBeDefined();
      expect(screen.getByText(/주의 \(20 ~ 30\)/)).toBeDefined();
      expect(screen.getByText(/경고 \(30 ~ 40\)/)).toBeDefined();
      expect(screen.getByText(/위기 \(40 이상\)/)).toBeDefined();

      // 마우스 벗어날 시 팝오버 닫힘
      fireEvent.mouseLeave(infoContainer);
      await waitFor(() => {
        expect(screen.queryByTestId('vix-info-popover')).toBeNull();
      });
    });

    it('Info 아이콘 클릭 시 팝오버가 토글되고 외부 클릭 시 자연스럽게 닫힌다', async () => {
      render(
        <MaskingProvider>
          <MarketAnalysisPage />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
      });

      const infoButton = screen.getByTestId('vix-info-button');

      // 클릭 시 팝오버 열림
      fireEvent.click(infoButton);
      expect(screen.getByTestId('vix-info-popover')).toBeDefined();

      // 다시 클릭 시 팝오버 닫힘 (토글)
      fireEvent.click(infoButton);
      await waitFor(() => {
        expect(screen.queryByTestId('vix-info-popover')).toBeNull();
      });

      // 다시 열기
      fireEvent.click(infoButton);
      expect(screen.getByTestId('vix-info-popover')).toBeDefined();

      // 외부(문서 바깥 영역) 클릭 시 닫힘
      fireEvent.mouseDown(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId('vix-info-popover')).toBeNull();
      });
    });
  });

  describe('통합 차트 및 상관관계 인사이트', () => {
    it('지수 종가, MDD, VIX가 1개의 통합 차트 컨테이너 내 3단 밀착 서브플롯으로 렌더링된다', async () => {
      render(
        <MaskingProvider>
          <MarketAnalysisPage />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
      });

      // 통합 차트 컨테이너 존재 검증
      expect(screen.getByTestId('integrated-market-chart')).toBeDefined();

      // 상단 요약 바에 3대 지표가 모여있는지 검증
      expect(screen.getByText(/최근 종가/)).toBeDefined();
      expect(screen.getByText(/최근 MDD/)).toBeDefined();
      expect(screen.getByText(/최근 VIX/)).toBeDefined();
    });

    it('선택된 기간 내 최대 공포(VIX 최고치)와 최대 낙폭(MDD 바닥) 상관관계 인사이트 칩이 올바르게 렌더링된다', async () => {
      render(
        <MaskingProvider>
          <MarketAnalysisPage />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
      });

      // 상관관계 인사이트 컨테이너 존재 검증
      const statsContainer = screen.getByTestId('correlation-stats-container');
      expect(statsContainer).toBeDefined();

      // mockHistoricalData 기준:
      // vix: [15.2, 14.8, 16.1] -> 최대 VIX는 2026-06-03의 16.10, 당시 MDD는 -0.58%
      // mdd: [0.0, 0.0, -0.58] -> 최대 낙폭(MDD 바닥)은 2026-06-03의 -0.58%, 당시 VIX는 16.10
      expect(screen.getByTestId('max-vix-chip')).toBeDefined();
      expect(screen.getByTestId('worst-mdd-chip')).toBeDefined();
      expect(screen.getByText(/기간 내 최대 공포 \(VIX 최고치\)/)).toBeDefined();
      expect(screen.getByText(/기간 내 최대 낙폭 \(MDD 바닥\)/)).toBeDefined();
    });
  });
});



