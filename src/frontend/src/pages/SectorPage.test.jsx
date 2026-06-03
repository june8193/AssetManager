import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SectorPage from './SectorPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// fetch 모킹 데이터 정의
const mockDashboardData = {
  period: "YTD",
  start_date: "2026-01-01",
  end_date: "2026-06-02",
  compare_index: "^KS11",
  index_returns: {
    "^KS11": {
      current: 2650.0,
      return_rate: 5.5
    },
    "^KQ11": {
      current: 850.0,
      return_rate: 2.1
    }
  },
  etfs: [
    {
      rank: 1,
      ticker: "069500",
      name: "KODEX 200",
      current_price: 35000.0,
      return_rate: 8.2,
      alpha: 2.7,
      judgment: "시장 상회"
    }
  ],
  custom_sectors: [
    {
      id: 1,
      name: "IT/반도체",
      stock_count: 2,
      return_rate: 12.5,
      alpha: 7.0,
      judgment: "시장 상회",
      stocks: [
        { stock_code: "005930", stock_name: "삼성전자", shares_outstanding: 50000000.0 }
      ]
    }
  ],
  watchlist: [
    {
      rank: 1,
      ticker: "000660",
      name: "SK하이닉스",
      current_price: 180000.0,
      return_rate: 15.0,
      alpha: 9.5,
      judgment: "시장 상회"
    }
  ]
};

describe('SectorPage', () => {
  let originalFetch;

  beforeEach(() => {
    // 원본 fetch 백업
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 테스트 종료 후 fetch 원상태 복구 (전역 오염 방지)
    global.fetch = originalFetch;
  });

  it('로딩 중일 때 로딩 인디케이터가 렌더링된다', async () => {
    // 끝나지 않는 프로미스로 fetch 모킹
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(
      <MaskingProvider>
        <SectorPage />
      </MaskingProvider>
    );

    expect(screen.getByText(/데이터를 분석 및 계산하는 중입니다/i)).toBeDefined();
  });

  it('에러 발생 시 에러 메시지와 재시도 버튼이 렌더링된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    render(
      <MaskingProvider>
        <SectorPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/오류가 발생했습니다/i)).toBeDefined();
    });

    const retryButton = screen.getByRole('button', { name: /다시 시도/i });
    expect(retryButton).toBeDefined();
  });

  it('정상 데이터 로드 시 주요 지수, 대표 ETF, 커스텀 섹터 정보가 올바르게 렌더링된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDashboardData
    });

    render(
      <MaskingProvider>
        <SectorPage />
      </MaskingProvider>
    );

    // 디버깅용 렌더 결과 출력
    screen.debug(undefined, 100000);

    // 헤더 타이틀 확인
    await waitFor(() => {
      expect(screen.getAllByText('KODEX 200')[0]).toBeDefined();
    });

    // 주요 지수 값 렌더링 확인 (천 단위 쉼표 제거 포맷 대응)
    expect(screen.getByText('2,650.00')).toBeDefined();
    
    // 대표 ETF 수익률 및 알파 검증
    expect(screen.getAllByText('+8.2%')[0]).toBeDefined();
    expect(screen.getAllByText('+2.7%p')[0]).toBeDefined();

    // 커스텀 섹터 수익률 검증
    expect(screen.getAllByText('IT/반도체')[0]).toBeDefined();
    expect(screen.getAllByText('+12.5%')[0]).toBeDefined();
    expect(screen.getAllByText('+7%p')[0]).toBeDefined();

    // 관심종목 수익률 검증
    expect(screen.getAllByText('SK하이닉스')[0]).toBeDefined();
    expect(screen.getAllByText('+15%')[0]).toBeDefined();
    expect(screen.getAllByText('+9.5%p')[0]).toBeDefined();
  });

  it('국가 탭 전환 버튼을 누르면 탭 상태가 변경되고 fetch가 새로 요청된다', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockDashboardData
    });

    render(
      <MaskingProvider>
        <SectorPage />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const usTabButton = screen.getByRole('button', { name: /미국 주식/i });
    fireEvent.click(usTabButton);

    await waitFor(() => {
      // 탭 전환 시 fetch가 다시 호출되었는지 최소 호출 횟수 검증 (리액트 리렌더링 오차 방지)
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      // 마지막 호출된 URL 파라미터가 미국 탭 사양(US, ^GSPC)으로 변경되었는지 검증
      const lastUrl = fetchSpy.mock.lastCall[0];
      expect(lastUrl).toContain('country=US');
      expect(lastUrl).toContain('compare_index=%5EGSPC');
    });
  });
});
