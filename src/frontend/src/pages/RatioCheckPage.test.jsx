import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RatioCheckPage, { renderCustomizedLabel } from './RatioCheckPage';
import { useRatios } from '../hooks/useRatios';
import { MaskingProvider } from '../contexts/MaskingContext';
import { BrowserRouter } from 'react-router-dom';

// useRatios 훅 모킹
vi.mock('../hooks/useRatios');

// JSDOM 크기 측정 버그 회피를 위해 recharts의 ResponsiveContainer 모킹
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 800, height: 800 }}>{children}</div>
    ),
  };
});

const mockHierarchy = [
  {
    category_name: '주식',
    category_type: 'major',
    current_value: 50000000,
    current_ratio: 50.0,
    color: '#6366f1',
    children: [
      {
        category_name: '국내주식',
        category_type: 'sub',
        current_value: 30000000,
        current_ratio: 60.0,
        color: '#3b82f6',
        children: [
          { 
            name: '삼성전자', 
            ticker: '005930', 
            valuation_krw: 30000000, 
            current_ratio: 100.0, 
            color: '#60a5fa',
            accounts: [
              { account_id: 2, account_name: '5526-9093', provider: '키움', alias: '일반 주식', quantity: 400, valuation_krw: 30000000 }
            ]
          }
        ]
      },
      {
        category_name: '해외주식',
        category_type: 'sub',
        current_value: 20000000,
        current_ratio: 40.0,
        color: '#8b5cf6',
        children: [
          { 
            name: '애플', 
            ticker: 'AAPL', 
            valuation_krw: 20000000, 
            current_ratio: 100.0, 
            color: '#a78bfa',
            accounts: [
              { account_id: 3, account_name: '6066-7729', provider: '키움', alias: '연금', quantity: 50, valuation_krw: 12000000 },
              { account_id: 4, account_name: '880-8864-2912-0', provider: '미래', alias: '개인', quantity: 30, valuation_krw: 8000000 }
            ]
          }
        ]
      }
    ]
  },
  {
    category_name: '현금',
    category_type: 'major',
    current_value: 50000000,
    current_ratio: 50.0,
    color: '#14b8a6',
    children: [
      {
        category_name: '원화현금',
        category_type: 'sub',
        current_value: 50000000,
        current_ratio: 100.0,
        color: '#06b6d4',
        children: [
          { 
            name: 'CMA예수금', 
            ticker: 'CMA', 
            valuation_krw: 50000000, 
            current_ratio: 100.0, 
            color: '#67e8f9',
            accounts: [
              { account_id: 5, account_name: '014-7558-3984-0', provider: '미래', alias: 'CMA', quantity: 50000000, valuation_krw: 50000000 }
            ]
          }
        ]
      }
    ]
  }
];

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <MaskingProvider>
        <RatioCheckPage />
      </MaskingProvider>
    </BrowserRouter>
  );
};

describe('RatioCheckPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // SVGElement.prototype.getBBox가 JSDOM에 없어 Recharts 렌더링 실패를 방지
    if (typeof window !== 'undefined' && window.SVGElement && !window.SVGElement.prototype.getBBox) {
      window.SVGElement.prototype.getBBox = () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  });

  it('로딩 중일 때 로딩 스피너/메시지를 표시한다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: [],
      loading: true,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();
    expect(screen.getByText(/자산 비중 데이터를 불러오는 중/i)).toBeDefined();
  });

  it('에러 발생 시 에러 메시지를 표시한다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: [],
      loading: false,
      error: 'API 에러 발생',
      refreshHierarchy: vi.fn()
    });

    renderComponent();
    expect(screen.getByText(/API 에러 발생/i)).toBeDefined();
  });

  it('초기 렌더링 시 대분류 항목 및 비중이 올바르게 나타난다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // 타이틀 확인
    expect(screen.getByText('자산 비중 점검')).toBeDefined();

    // 대분류 리스트 렌더링 확인
    expect(screen.getByText('주식')).toBeDefined();
    expect(screen.getByText('현금')).toBeDefined();

    // 각 대분류 비중 확인 (전체 1억 중 5천만씩이므로 50.0%)
    const ratios = screen.getAllByText('50.0%');
    expect(ratios.length).toBeGreaterThanOrEqual(2);
  });

  it('대분류 클릭 시 중분류 단계로 드릴다운되고 Breadcrumb과 중앙 레이블이 업데이트된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' 행 클릭
    const stockElement = screen.getByText('주식');
    fireEvent.click(stockElement);

    // 중분류인 '국내주식', '해외주식' 노출 확인
    expect(screen.getByText('국내주식')).toBeDefined();
    expect(screen.getByText('해외주식')).toBeDefined();

    // Breadcrumb에 대분류 이름이 반영되었는지 확인
    const breadcrumbMajor = screen.getByTestId('breadcrumb-major');
    expect(breadcrumbMajor.textContent).toBe('주식');
  });

  it('중분류 클릭 시 종목 단계로 드릴다운되어 종목 정보가 노출된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' 클릭 -> 중분류 진입
    fireEvent.click(screen.getByText('주식'));

    // '해외주식' 클릭 -> 종목 진입
    fireEvent.click(screen.getByText('해외주식'));

    // 종목인 '애플' 및 티커 'AAPL' 노출 확인
    expect(screen.getByText(/애플/i)).toBeDefined();
    expect(screen.getByText(/AAPL/i)).toBeDefined();

    // 계좌 상세 정보 노출 확인 (증권사, 계좌이름(별칭) 포맷)
    expect(screen.getByText(/키움, 6066-7729\(연금\)/i)).toBeDefined();
    expect(screen.getByText(/미래, 880-8864-2912-0\(개인\)/i)).toBeDefined();
  });

  it('Breadcrumb 클릭 시 상위 수준으로 정상적으로 복구된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' 클릭하여 중분류 진입
    fireEvent.click(screen.getByText('주식'));
    expect(screen.queryByText('현금')).toBeNull(); // 주식 하위에서는 '현금'이 안 보여야 함

    // Breadcrumb의 '포트폴리오' 클릭하여 최상위로 돌아감
    const portfolioBreadcrumb = screen.getByText('포트폴리오');
    fireEvent.click(portfolioBreadcrumb);

    // 최상위 항목인 '현금'이 다시 노출되는지 확인
    expect(screen.getByText('현금')).toBeDefined();
  });

  it('renderCustomizedLabel 함수가 주어진 속성에 따라 지시선 라벨과 비율 텍스트를 정상 렌더링한다', () => {
    const mockProps = {
      cx: 200,
      cy: 200,
      midAngle: 45,
      outerRadius: 100,
      fill: '#6366f1',
      percent: 0.528,
      name: '주식'
    };

    render(
      <svg>
        {renderCustomizedLabel(mockProps)}
      </svg>
    );

    // 이름 렌더링 검증
    expect(screen.getByText('주식')).toBeDefined();
    // 비율 렌더링 검증 (0.528 => 52.8%)
    expect(screen.getByText('52.8%')).toBeDefined();
  });

  it('renderCustomizedLabel 함수는 비중이 1% 미만인 항목의 라벨을 렌더링하지 않는다', () => {
    const mockPropsSmall = {
      cx: 200,
      cy: 200,
      midAngle: 45,
      outerRadius: 100,
      fill: '#6366f1',
      percent: 0.005, // 0.5%
      name: '소액자산'
    };

    render(
      <svg>
        {renderCustomizedLabel(mockPropsSmall)}
      </svg>
    );

    // 1% 미만은 렌더링되지 않아야 함
    expect(screen.queryByText('소액자산')).toBeNull();
  });
});
