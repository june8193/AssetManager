import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WatchlistForm from './WatchlistForm';

// fetch를 모킹하여 검색 API 응답을 시뮬레이션
const mockSearchResults = [
  { stock_code: '005930', stock_name: '삼성전자' },
  { stock_code: '005935', stock_name: '삼성전자우' },
  { stock_code: '005380', stock_name: '현대차' },
];

describe('WatchlistForm 자동완성 검색', () => {
  let mockOnAdd;

  beforeEach(() => {
    mockOnAdd = vi.fn().mockResolvedValue(true);
    // 전역 fetch 모킹
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/stocks/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSearchResults),
        });
      }
      return Promise.reject(new Error('unknown url'));
    });
  });

  it('검색 입력창이 렌더링되어야 한다', () => {
    render(<WatchlistForm onAdd={mockOnAdd} error={null} />);
    const input = screen.getByPlaceholderText(/종목명 또는 종목코드/i);
    expect(input).toBeInTheDocument();
  });

  it('검색어 입력 시 드롭다운에 검색 결과가 표시되어야 한다', async () => {
    render(<WatchlistForm onAdd={mockOnAdd} error={null} />);
    const input = screen.getByPlaceholderText(/종목명 또는 종목코드/i);

    await userEvent.type(input, '삼성');

    // API 호출 후 드롭다운에 결과가 나타나길 기다림
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument();
    });
  });

  it('드롭다운 항목 클릭 시 onAdd가 호출되어야 한다', async () => {
    render(<WatchlistForm onAdd={mockOnAdd} error={null} />);
    const input = screen.getByPlaceholderText(/종목명 또는 종목코드/i);

    await userEvent.type(input, '삼성');

    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument();
    });

    // 첫 번째 결과 클릭
    fireEvent.click(screen.getByText('삼성전자'));

    expect(mockOnAdd).toHaveBeenCalledWith('005930', '삼성전자');
  });

  it('에러 메시지가 표시되어야 한다', () => {
    render(<WatchlistForm onAdd={mockOnAdd} error="중복된 종목입니다." />);
    expect(screen.getByText('중복된 종목입니다.')).toBeInTheDocument();
  });
});
