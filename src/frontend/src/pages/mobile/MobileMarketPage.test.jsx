import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileMarketPage from './MobileMarketPage';
import { MaskingProvider } from '../../contexts/MaskingContext';

const mockHistoricalGSPC = {
  labels: ['2026-06-01', '2026-06-02', '2026-06-03'],
  prices: [5100.0, 5150.0, 5200.0],
  mdd: [-2.5, -1.5, 0.0],
  vix: [18.2, 17.5, 16.1],
};

const mockIndicesKR = [
  { index_name: 'KOSPI', current_price: 2650.5, change_rate: 0.85 },
  { index_name: 'KOSDAQ', current_price: 850.2, change_rate: -0.42 },
];

const mockIndicesUS = [
  { index_name: 'S&P 500', current_price: 5200.0, change_rate: 1.25 },
  { index_name: 'NASDAQ', current_price: 17500.0, change_rate: 1.74 },
];

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/m/market']}>
      <MaskingProvider>
        <MobileMarketPage />
      </MaskingProvider>
    </MemoryRouter>
  );
}

describe('MobileMarketPage', () => {
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockHistoricalGSPC),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
  });
  it('헤더와 기본 서브 탭([시장 지수], [포트폴리오 비교])이 올바르게 렌더링되어야 한다', async () => {
    renderComponent();

    // 페이지 헤더
    expect(screen.getByRole('heading', { name: /지수분석/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();

    // 서브 탭 스위처 버튼들
    const marketTabBtn = screen.getByRole('tab', { name: /시장 지수/i });
    const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });

    expect(marketTabBtn).toBeInTheDocument();
    expect(compareTabBtn).toBeInTheDocument();

    // 기본 활성 탭은 '시장 지수'
    expect(marketTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(compareTabBtn).toHaveAttribute('aria-selected', 'false');

    // 시장 지수 뷰의 쉘/컨테이너 표시 확인
    expect(screen.getByTestId('market-indices-view')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
    });
  });

  it('[포트폴리오 비교] 탭을 클릭하면 서브 탭 활성화가 전환되고 해당 뷰가 렌더링되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
    });

    const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });
    const marketTabBtn = screen.getByRole('tab', { name: /시장 지수/i });

    // 포트폴리오 비교 탭 클릭
    fireEvent.click(compareTabBtn);

    expect(compareTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(marketTabBtn).toHaveAttribute('aria-selected', 'false');

    // 포트폴리오 비교 뷰 컨테이너 표시 확인
    expect(screen.getByTestId('portfolio-comparison-view')).toBeInTheDocument();
    expect(screen.queryByTestId('market-indices-view')).not.toBeInTheDocument();

    // 다시 시장 지수 탭 클릭 시 정상 복귀
    fireEvent.click(marketTabBtn);

    expect(marketTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(compareTabBtn).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('market-indices-view')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-comparison-view')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
    });
  });

  it('새로고침 버튼 클릭 시 최신화 토스트 알림이 표시되어야 한다', async () => {
    renderComponent();

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByTestId('market-toast')).toBeInTheDocument();
      expect(screen.getByTestId('market-toast')).toHaveTextContent('지수 및 시장 데이터가 최신화되었습니다.');
    });
  });

  it('마스킹이 활성화되었을 때 포트폴리오 수익률 수치가 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');
    try {
      renderComponent();

      const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });
      fireEvent.click(compareTabBtn);

      const maskedEl = screen.getByTestId('masked-return');
      expect(maskedEl).toHaveTextContent('***');
    } finally {
      localStorage.removeItem('isMasked');
    }
  });

  it('[시장 지수] 탭에서 4대 지수 칩과 3단 차트가 연동되어 렌더링되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('index-chip-^GSPC')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-stacked-chart-card')).toBeInTheDocument();
      expect(screen.getByTestId('vix-summary-card')).toBeInTheDocument();
    });
  });
});

