import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MobileMarketIndexSection, { getVixStatus } from './MobileMarketIndexSection';

const mockHistoricalGSPC = {
  labels: ['2026-06-01', '2026-06-02', '2026-06-03'],
  prices: [5100.0, 5150.0, 5200.0],
  mdd: [-2.5, -1.5, 0.0],
  vix: [18.2, 17.5, 16.1],
};

const mockHistoricalIXIC = {
  labels: ['2026-06-01', '2026-06-02', '2026-06-03'],
  prices: [17000.0, 17200.0, 17500.0],
  mdd: [-4.0, -3.0, -1.0],
  vix: [18.2, 17.5, 16.1],
};

const mockIndicesKR = [
  { index_name: 'KOSPI', current_price: 2650.5, change_rate: 0.85 },
  { index_name: 'KOSDAQ', current_price: 850.2, change_rate: -0.42 },
];

const mockIndicesUS = [
  { index_name: 'S&P 500', current_price: 5200.0, change_rate: 1.25 },
  { index_name: 'NASDAQ', current_price: 17500.0, change_rate: 1.74 },
  { index_name: 'DOW JONES', current_price: 39000.0, change_rate: 0.31 },
];

describe('MobileMarketIndexSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/market/indices')) {
        if (urlStr.includes('country=US')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIndicesUS),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIndicesKR),
        });
      }
      if (urlStr.includes('/api/market/analysis/historical')) {
        if (urlStr.includes('ticker=%5EIXIC') || urlStr.includes('ticker=^IXIC')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockHistoricalIXIC),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockHistoricalGSPC),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });
  });

  describe('getVixStatus 단위 함수 검증', () => {
    it('VIX 값에 따라 4단계 리스크 레벨(안정/주의/경고/위기)을 올바르게 판정한다', () => {
      expect(getVixStatus(null)).toBeNull();
      expect(getVixStatus(undefined)).toBeNull();

      // < 20: 안정
      const stable = getVixStatus(16.5);
      expect(stable.level).toBe('stable');
      expect(stable.label).toBe('안정');

      // 20 <= vix < 25: 주의
      const caution = getVixStatus(22.0);
      expect(caution.level).toBe('caution');
      expect(caution.label).toBe('주의');

      // 25 <= vix < 30: 경고
      const warning = getVixStatus(27.5);
      expect(warning.level).toBe('warning');
      expect(warning.label).toBe('경고');

      // >= 30: 위기
      const crisis = getVixStatus(34.0);
      expect(crisis.level).toBe('crisis');
      expect(crisis.label).toBe('위기');
    });
  });

  describe('컴포넌트 렌더링 및 인터랙션', () => {
    it('상단 4대 지수 칩과 기간 필터가 렌더링되고 기본 지수는 S&P 500이다', async () => {
      render(<MobileMarketIndexSection />);

      // 로딩 완료 대기
      await waitFor(() => {
        expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
      });

      // 4대 지수 칩 렌더링 확인
      expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
      expect(screen.getByTestId('index-chip-^IXIC')).toBeInTheDocument();
      expect(screen.getByTestId('index-chip-^KS11')).toBeInTheDocument();
      expect(screen.getByTestId('index-chip-^KQ11')).toBeInTheDocument();

      // 기본 선택 지수는 S&P 500 (^GSPC)
      const spChip = screen.getByTestId('index-chip-^GSPC');
      expect(spChip).toHaveAttribute('aria-pressed', 'true');

      // 5개 기간 필터 (1Y, 3Y, 5Y, 10Y, ALL)
      expect(screen.getByRole('button', { name: '1년' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3년' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5년' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '10년' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    });

    it('지수 칩을 클릭하면 선택된 지수가 변경되고 해당 지수 데이터가 요청된다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
      });

      const nasdaqChip = screen.getByTestId('index-chip-^IXIC');
      fireEvent.click(nasdaqChip);

      expect(nasdaqChip).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('index-chip-^GSPC')).toHaveAttribute('aria-pressed', 'false');

      // NASDAQ API 호출 확인
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/ticker=(%5EIXIC|\^IXIC)/)
        );
      });
    });

    it('기간 필터를 클릭하면 선택된 기간이 변경되고 새로운 날짜 범위로 API를 요청한다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '1년' })).toBeInTheDocument();
      });

      const fiveYearBtn = screen.getByRole('button', { name: '5년' });
      fireEvent.click(fiveYearBtn);

      expect(fiveYearBtn).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('start_date=')
        );
      });
    });

    it('상단 VIX 상태 요약 카드에 현재 VIX 수치 및 리스크 배지가 표시된다', async () => {
      render(<MobileMarketIndexSection />);

      // mockHistoricalGSPC의 마지막 VIX: 16.1 -> 16.10, 안정 배지
      await waitFor(() => {
        expect(screen.getByTestId('vix-summary-card')).toBeInTheDocument();
        expect(screen.getByTestId('vix-latest-value')).toHaveTextContent('16.10');
        expect(screen.getByTestId('vix-risk-badge')).toHaveTextContent('안정');
      });
    });

    it('차트 카드 상단에 3개 서브탭 스위처가 렌더링되고 기본값은 지수 종가 단독 뷰(260px)이다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-stacked-chart-card')).toBeInTheDocument();
      });

      // 3개 서브탭 스위처 렌더링 확인
      const tabPrice = screen.getByTestId('chart-tab-price');
      const tabMdd = screen.getByTestId('chart-tab-mdd');
      const tabVix = screen.getByTestId('chart-tab-vix');

      expect(tabPrice).toBeInTheDocument();
      expect(tabMdd).toBeInTheDocument();
      expect(tabVix).toBeInTheDocument();

      // 기본 선택값: '지수 종가'
      expect(tabPrice).toHaveAttribute('aria-pressed', 'true');
      expect(tabMdd).toHaveAttribute('aria-pressed', 'false');
      expect(tabVix).toHaveAttribute('aria-pressed', 'false');

      // 1화면 1차트: 기본적으로 지수 종가 차트만 260px 높이로 렌더링되고 나머지는 숨김
      const priceChart = screen.getByTestId('chart-tier-price');
      expect(priceChart).toBeInTheDocument();
      expect(priceChart.querySelector('.h-\\[260px\\]')).toBeInTheDocument();

      expect(screen.queryByTestId('chart-tier-mdd')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart-tier-vix')).not.toBeInTheDocument();
    });

    it('서브탭을 클릭하면 해당 차트 1개만 260px 단독 뷰로 표시되고 이전 차트는 숨겨진다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-tab-price')).toBeInTheDocument();
      });

      // 1. [📉 낙폭 (MDD)] 탭 클릭
      const tabMdd = screen.getByTestId('chart-tab-mdd');
      fireEvent.click(tabMdd);

      expect(tabMdd).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('chart-tab-price')).toHaveAttribute('aria-pressed', 'false');

      const mddChart = screen.getByTestId('chart-tier-mdd');
      expect(mddChart).toBeInTheDocument();
      expect(mddChart.querySelector('.h-\\[260px\\]')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-tier-price')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart-tier-vix')).not.toBeInTheDocument();

      // 2. [⚡ VIX 변동성] 탭 클릭
      const tabVix = screen.getByTestId('chart-tab-vix');
      fireEvent.click(tabVix);

      expect(tabVix).toHaveAttribute('aria-pressed', 'true');
      expect(tabMdd).toHaveAttribute('aria-pressed', 'false');

      const vixChart = screen.getByTestId('chart-tier-vix');
      expect(vixChart).toBeInTheDocument();
      expect(vixChart.querySelector('.h-\\[260px\\]')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-tier-price')).not.toBeInTheDocument();
      expect(screen.queryByTestId('chart-tier-mdd')).not.toBeInTheDocument();
    });

    it('VIX 탭 활성화 시 헤더 우측에 주의 20 및 경고 30 범례 뱃지가 노출되고 다른 탭에서는 숨겨진다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-tab-price')).toBeInTheDocument();
      });

      // 기본 지수 종가 탭에서는 VIX 범례 뱃지가 없어야 함
      expect(screen.queryByTestId('vix-legend-badges')).not.toBeInTheDocument();
      expect(screen.queryByTestId('vix-legend-badge-caution')).not.toBeInTheDocument();
      expect(screen.queryByTestId('vix-legend-badge-warning')).not.toBeInTheDocument();

      // VIX 탭으로 전환
      const tabVix = screen.getByTestId('chart-tab-vix');
      fireEvent.click(tabVix);

      // 헤더 우측에 VIX 범례 뱃지가 노출되어야 함
      const legendBadges = screen.getByTestId('vix-legend-badges');
      expect(legendBadges).toBeInTheDocument();

      const cautionBadge = screen.getByTestId('vix-legend-badge-caution');
      expect(cautionBadge).toBeInTheDocument();
      expect(cautionBadge).toHaveTextContent('주의 20');
      expect(cautionBadge.className).toContain('text-amber-400');
      expect(cautionBadge.className).toContain('border-amber-500');

      const warningBadge = screen.getByTestId('vix-legend-badge-warning');
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge).toHaveTextContent('경고 30');
      expect(warningBadge.className).toContain('text-rose-400');
      expect(warningBadge.className).toContain('border-rose-500');

      // 다시 MDD 탭으로 전환하면 범례 뱃지가 사라져야 함
      const tabMdd = screen.getByTestId('chart-tab-mdd');
      fireEvent.click(tabMdd);
      expect(screen.queryByTestId('vix-legend-badges')).not.toBeInTheDocument();
    });

    it('VIX 차트 내 가로 기준선은 차트 영역 내부 텍스트 라벨 없이 파선으로만 렌더링된다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-tab-vix')).toBeInTheDocument();
      });

      // VIX 탭으로 전환
      fireEvent.click(screen.getByTestId('chart-tab-vix'));

      const vixChart = screen.getByTestId('chart-tier-vix');
      expect(vixChart).toBeInTheDocument();

      // 차트 SVG/영역 내부에는 곡선을 가리는 '주의 20', '경고 30' 텍스트 라벨이 존재하지 않아야 함
      // (기존 label={{ value: '주의 20' }} 등으로 인한 SVG 텍스트 오버랩 방지)
      const chartInnerLabels = vixChart.querySelectorAll('.recharts-reference-line-text');
      expect(chartInnerLabels.length).toBe(0);

      // 기준선 라인 요소 확인 (strokeDasharray="4 3", strokeWidth="1.2")
      const refLines = vixChart.querySelectorAll('.recharts-reference-line-line');
      expect(refLines.length).toBe(2);
      refLines.forEach((line) => {
        expect(line.getAttribute('stroke-dasharray')).toBe('4 3');
        expect(line.getAttribute('stroke-width')).toBe('1.2');
      });
    });

    it('서브탭 전환 후에도 지수 칩 변경 및 기간 필터 변경 시 단독 차트 데이터와 극단값 카드가 정상 연동된다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-tab-mdd')).toBeInTheDocument();
      });

      // MDD 탭으로 전환
      fireEvent.click(screen.getByTestId('chart-tab-mdd'));
      expect(screen.getByTestId('chart-tier-mdd')).toBeInTheDocument();

      // NASDAQ 지수 선택
      const nasdaqChip = screen.getByTestId('index-chip-^IXIC');
      fireEvent.click(nasdaqChip);

      // 극단값 카드가 NASDAQ 데이터로 갱신되고 MDD 차트가 유지되는지 확인
      await waitFor(() => {
        const worstMddCard = screen.getByTestId('extreme-card-worst-mdd');
        expect(worstMddCard).toHaveTextContent('-4.00%');
        expect(worstMddCard).toHaveTextContent('17,000.0 pt');
      });
      expect(screen.getByTestId('chart-tier-mdd')).toBeInTheDocument();
    });

    it('API 호출 실패 시 에러 메시지와 재시도 버튼이 노출된다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('네트워크 연결 실패'));
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('market-index-error')).toBeInTheDocument();
        expect(screen.getByText('네트워크 연결 실패')).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
      expect(retryBtn).toBeInTheDocument();
    });

    it('3단 차트 하단에 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 카드가 연동 렌더링된다', async () => {
      render(<MobileMarketIndexSection />);

      // 극단값 카드 컨테이너 대기
      await waitFor(() => {
        expect(screen.getByTestId('extreme-stats-cards-container')).toBeInTheDocument();
      });

      // 🟣 최대 공포 (VIX 피크) 카드
      const maxVixCard = screen.getByTestId('extreme-card-max-vix');
      expect(maxVixCard).toHaveTextContent('2026-06-01');
      expect(maxVixCard).toHaveTextContent('18.20 pt');
      expect(maxVixCard).toHaveTextContent('-2.50%');
      expect(maxVixCard).toHaveTextContent('5,100.0 pt');

      // 🔴 최대 낙폭 (MDD 바닥) 카드
      const worstMddCard = screen.getByTestId('extreme-card-worst-mdd');
      expect(worstMddCard).toHaveTextContent('2026-06-01');
      expect(worstMddCard).toHaveTextContent('-2.50%');
      expect(worstMddCard).toHaveTextContent('18.20 pt');
      expect(worstMddCard).toHaveTextContent('5,100.0 pt');
    });

    it('지수 칩을 변경하면 2대 극단값 카드의 수치와 당시 종가가 즉시 재계산되어 갱신된다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('extreme-card-worst-mdd')).toHaveTextContent('5,100.0 pt');
      });

      // NASDAQ (^IXIC) 칩 클릭
      const nasdaqChip = screen.getByTestId('index-chip-^IXIC');
      fireEvent.click(nasdaqChip);

      // NASDAQ 데이터로 극단값 카드 재계산 및 갱신 대기 (MDD 바닥: -4.00%, 가격: 17,000.0 pt)
      await waitFor(() => {
        const worstMddCard = screen.getByTestId('extreme-card-worst-mdd');
        expect(worstMddCard).toHaveTextContent('-4.00%');
        expect(worstMddCard).toHaveTextContent('17,000.0 pt');
      });
    });
  });
});
