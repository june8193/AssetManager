import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WatchlistSectorPage from './WatchlistSectorPage';

const mockWatchlistData = [
  { id: 1, stock_code: "005930", stock_name: "삼성전자", country: "KR" }
];

const mockSectorsData = [
  {
    id: 1,
    name: "IT/반도체",
    country: "KR",
    stocks: [
      { stock_code: "000660", stock_name: "SK하이닉스", shares_outstanding: 728002365.0 }
    ]
  }
];

const mockSearchData = [
  { stock_code: "005930", stock_name: "삼성전자", market: "KOSPI" },
  { stock_code: "000660", stock_name: "SK하이닉스", market: "KOSPI" }
];

describe('WatchlistSectorPage', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
    
    // 기본 fetch 모킹
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/watchlist?country=')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockWatchlistData
        });
      }
      if (url.includes('/api/sector/custom?country=')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSectorsData
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => []
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('기본 UI 및 탭, 테이블이 정상적으로 렌더링된다', async () => {
    render(<WatchlistSectorPage />);

    // 헤더 확인
    expect(screen.getByText('관심종목/섹터 관리')).toBeDefined();
    
    // 국가 탭 로드 확인
    expect(screen.getByRole('button', { name: /국내 주식/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /미국 주식/i })).toBeDefined();

    // 로딩 대기
    await waitFor(() => {
      // 관심종목 테이블 데이터 로드 확인
      expect(screen.getByText('삼성전자')).toBeDefined();
      // 커스텀 섹터 리스트 데이터 로드 확인
      expect(screen.getByText('IT/반도체')).toBeDefined();
      expect(screen.getByText('SK하이닉스')).toBeDefined();
    });
  });

  it('국가 탭 전환 버튼 클릭 시 fetch가 새로 실행된다', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<WatchlistSectorPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const usTabButton = screen.getByRole('button', { name: /미국 주식/i });
    fireEvent.click(usTabButton);

    await waitFor(() => {
      // country=US로 새롭게 요청되는지 확인
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('country=US'));
    });
  });

  it('종목 검색 수행 시 검색 결과가 노출된다', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/stocks/search?q=')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSearchData
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => []
      });
    });

    render(<WatchlistSectorPage />);

    const searchInput = screen.getByPlaceholderText(/종목명 또는 6자리 종목코드를 입력하세요/i);
    const searchButton = screen.getByRole('button', { name: /검색/i });

    fireEvent.change(searchInput, { target: { value: '삼성' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      // 검색 결과 내 버튼들 확인
      expect(screen.getAllByText('관심종목 등록')).toHaveLength(2);
      expect(screen.getAllByText('섹터 추가')).toHaveLength(2);
    });
  });

  it('관심종목 등록 버튼 클릭 시 POST API를 호출한다', async () => {
    let postBody = null;
    global.fetch = vi.fn().mockImplementation((url, init) => {
      if (url.includes('/api/stocks/search?q=')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockSearchData[0]]
        });
      }
      if (url.includes('/api/watchlist') && init && init.method === 'POST') {
        postBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 2, stock_code: "005930", stock_name: "삼성전자", country: "KR" })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => []
      });
    });

    render(<WatchlistSectorPage />);

    const searchInput = screen.getByPlaceholderText(/종목명 또는 6자리 종목코드를 입력하세요/i);
    const searchButton = screen.getByRole('button', { name: /검색/i });

    fireEvent.change(searchInput, { target: { value: '삼성' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('관심종목 등록')).toBeDefined();
    });

    fireEvent.click(screen.getByText('관심종목 등록'));

    await waitFor(() => {
      expect(postBody).toEqual({
        stock_code: "005930",
        stock_name: "삼성전자",
        country: "KR"
      });
    });
  });

  it('섹터 추가 버튼 클릭 시 모달이 오픈되고 섹터에 종목 추가 API를 전송한다', async () => {
    let addStockBody = null;
    global.fetch = vi.fn().mockImplementation((url, init) => {
      if (url.includes('/api/sector/custom?country=')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSectorsData
        });
      }
      if (url.includes('/api/stocks/search?q=')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockSearchData[0]]
        });
      }
      if (url.includes('/api/sector/custom/1/stock') && init && init.method === 'POST') {
        addStockBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ stock_code: "005930", stock_name: "삼성전자", shares_outstanding: 1000 })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => []
      });
    });

    render(<WatchlistSectorPage />);

    const searchInput = screen.getByPlaceholderText(/종목명 또는 6자리 종목코드를 입력하세요/i);
    const searchButton = screen.getByRole('button', { name: /검색/i });

    fireEvent.change(searchInput, { target: { value: '삼성' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('섹터 추가')).toBeDefined();
    });

    fireEvent.click(screen.getByText('섹터 추가'));

    // 모달창 오픈 검증
    expect(screen.getByText('커스텀 섹터에 종목 추가')).toBeDefined();
    
    // 드롭다운 선택
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } }); // IT/반도체 섹터 선택

    const confirmBtn = screen.getByRole('button', { name: /섹터에 추가/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(addStockBody).toEqual({
        stock_code: "005930",
        stock_name: "삼성전자",
        shares_outstanding: null // 자동 수집되도록 null 전송 검증
      });
    });
  });
});
