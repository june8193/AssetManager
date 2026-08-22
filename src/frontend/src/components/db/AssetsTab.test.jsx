import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import AssetsTab from './AssetsTab';

describe('AssetsTab', () => {
  const mockAssets = [
    { id: 1, ticker: 'AAPL', name: '애플', major_category: '주식', sub_category: '알파(성장)', country: 'US' }
  ];

  const mockCategories = {
    "주식": ["코어(지수)", "알파(성장)", "배당주"],
    "채권": ["미국장기채"],
    "현금": ["원화예수금", "달러예수금"]
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 2, ...JSON.parse(options.body) }),
        });
      }
      if (url.endsWith('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAssets),
        });
      }
      if (url.endsWith('/assets/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategories),
        });
      }
      if (url.includes('/assets/verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ name: '테슬라' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('자산 목록이 렌더링되어야 한다', async () => {
    render(<AssetsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('애플')).toBeInTheDocument();
    });
  });

  it('자산 추가 시 조회를 거쳐 추가 버튼이 활성화되고 폼이 제출되어야 한다', async () => {
    render(<AssetsTab />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('예: AAPL, 005930')).toBeInTheDocument();
    });

    // 1. 티커 입력
    fireEvent.change(screen.getByPlaceholderText('예: AAPL, 005930'), { target: { value: 'TSLA', name: 'ticker' } });
    
    // 2. 대분류 및 중분류 선택
    const majorSelect = screen.getByRole('combobox', { name: /대분류/i });
    fireEvent.change(majorSelect, { target: { value: '주식' } });
    
    const subSelect = screen.getByRole('combobox', { name: /중분류/i });
    fireEvent.change(subSelect, { target: { value: '알파(성장)' } });

    // 3. 국가 선택
    const countrySelect = screen.getByRole('combobox', { name: /국가/i });
    fireEvent.change(countrySelect, { target: { value: 'US' } });

    // 4. 자산명은 자동 완성이므로 직접 쓰지 않음 (readOnly)
    expect(screen.getByPlaceholderText('조회 시 자동 완성')).toHaveAttribute('readonly');

    // 5. 조회 버튼 클릭
    const verifyButton = screen.getByRole('button', { name: /조회/i });
    fireEvent.click(verifyButton);

    // 6. 조회 완료 후 자산명이 기입되고 '추가' 버튼이 노출되는지 대기
    await waitFor(() => {
      expect(screen.getByDisplayValue('테슬라')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /추가/i })).toBeInTheDocument();
    });

    // 7. 추가 버튼 클릭
    fireEvent.click(screen.getByRole('button', { name: /추가/i }));

    await waitFor(() => {
      // POST 호출이 정상 처리되었는지 검증
      const postCall = vi.mocked(global.fetch).mock.calls.find(call => call[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(postCall[0]).toContain('/assets');
      
      const payload = JSON.parse(postCall[1].body);
      expect(payload.ticker).toBe('TSLA');
      expect(payload.name).toBe('테슬라');
      expect(payload.major_category).toBe('주식');
      expect(payload.sub_category).toBe('알파(성장)');
      expect(payload.country).toBe('US');
    });
  });
});
