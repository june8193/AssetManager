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

    it('단일 카드 내 3단 밀착 동기화 차트(지수 종가, MDD, VIX 및 기준선)가 렌더링된다', async () => {
      render(<MobileMarketIndexSection />);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-stacked-chart-card')).toBeInTheDocument();
      });

      // 1단: 지수 종가
      expect(screen.getByTestId('chart-tier-price')).toBeInTheDocument();
      // 2단: MDD
      expect(screen.getByTestId('chart-tier-mdd')).toBeInTheDocument();
      // 3단: VIX
      expect(screen.getByTestId('chart-tier-vix')).toBeInTheDocument();

      // VIX 기준선 텍스트 라벨 (주의 20, 경고 30)
      expect(screen.getByText(/주의 20/)).toBeInTheDocument();
      expect(screen.getByText(/경고 30/)).toBeInTheDocument();
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
