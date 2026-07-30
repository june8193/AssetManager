// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PerformanceAnalysisPage from './PerformanceAnalysisPage';

const mockRiskFreeRate = { rate: 3.5 };
const mockPortfolioPerf = {
  period: '1Y',
  sharpe_ratio: 1.25,
  sortino_ratio: 1.58,
  mdd: -4.32,
  max_mdd: -7.85,
  annualized_return: 12.4,
  annualized_volatility: 9.8,
  drawdown_series: [
    { date: '2026-01-01', drawdown: 0.0 },
    { date: '2026-01-02', drawdown: -1.2 },
    { date: '2026-01-03', drawdown: -4.32 }
  ]
};

const mockAssetsBatch = [
  {
    ticker: '^KS11',
    name: '코스피 (KOSPI)',
    asset_type: 'benchmark',
    sharpe_ratio: 1.10,
    sortino_ratio: 1.30,
    mdd: -6.5,
    annualized_return: 10.5
  },
  {
    ticker: '005930',
    name: '삼성전자',
    asset_type: 'holding',
    sharpe_ratio: 1.45,
    sortino_ratio: 1.80,
    mdd: -3.2,
    annualized_return: 15.2
  }
];

describe('PerformanceAnalysisPage - 성과 분석 대시보드 UI', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.includes('/api/v1/performance/settings/risk-free-rate')) {
        if (options && options.method === 'PUT') {
          const body = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rate: body.rate })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRiskFreeRate)
        });
      }
      if (url.includes('/api/v1/performance/assets/batch')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAssetsBatch)
        });
      }
      if (url.includes('/api/v1/performance/portfolio')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPortfolioPerf)
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    }));
  });

  it('대시보드가 정상 렌더링되며 Sharpe, Sortino, MDD KPI 수치 및 종목 비교 테이블이 표시된다', async () => {
    render(<PerformanceAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('위험조정 성과 분석 대시보드')).toBeDefined();
      expect(screen.getByText('보유 종목 및 벤치마크 지수 위험조정 성과 비교')).toBeDefined();
    });

    expect(screen.getByText('1.25')).toBeDefined();
    expect(screen.getByText('1.58')).toBeDefined();
    expect(screen.getByText('-4.32%')).toBeDefined();

    // 종목 비교 테이블 데이터 검증
    expect(screen.getByText('삼성전자')).toBeDefined();
    expect(screen.getByText('코스피 (KOSPI)')).toBeDefined();
    expect(screen.getByText('벤치마크')).toBeDefined();
    expect(screen.getByText('보유종목')).toBeDefined();
  });

  it('무위험 수익률 설정 버튼 클릭 후 수정 및 저장 시 API가 호출된다', async () => {
    render(<PerformanceAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('3.50%')).toBeDefined();
    });

    const editBtn = screen.getByRole('button', { name: /설정 변경/i });
    fireEvent.click(editBtn);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '4.2' } });

    const saveBtn = screen.getByRole('button', { name: /저장/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('4.20%')).toBeDefined();
    });
  });

  it('ⓘ 도움말 아이콘 클릭 시 안내 모달이 오픈된다', async () => {
    render(<PerformanceAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('위험조정 성과 분석 대시보드')).toBeDefined();
    });

    const infoBtn = screen.getByTitle('AssetManager 상세 산출 공식 보기');
    fireEvent.click(infoBtn);

    await waitFor(() => {
      expect(screen.getByText('AssetManager 위험조정 성과 산출 공식 & 산출 안내')).toBeDefined();
    });
  });
});

