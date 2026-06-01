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

  it('중분류 클릭 시 종목 단계로 드릴다운되어 종목 정보가 노출되며, 자산 클릭 전에는 계좌 정보가 노출되지 않다가 클릭 후 펼쳐진다', () => {
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

    // 아코디언이 기본적으로 닫혀있으므로 계좌 상세 정보는 처음에는 노출되지 않음
    expect(screen.queryByText(/6066-7729/i)).toBeNull();

    // '애플' 항목 클릭하여 아코디언 펼침
    fireEvent.click(screen.getByText(/애플/i));

    // 이제 계좌 상세 정보(증권사, 계좌이름 등) 노출 확인
    expect(screen.getByText(/6066-7729/i)).toBeDefined();
    expect(screen.getByText(/880-8864-2912-0/i)).toBeDefined();
    expect(screen.getAllByText(/키움/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/미래/i).length).toBeGreaterThanOrEqual(1);
  });

  it('소분류 단계에서 자산을 재클릭하면 아코디언이 다시 닫히고, 상위 레벨로 이동 시 아코디언 상태가 리셋된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' 클릭 -> '해외주식' 클릭
    fireEvent.click(screen.getByText('주식'));
    fireEvent.click(screen.getByText('해외주식'));

    // 1. 펼치기
    fireEvent.click(screen.getByText(/애플/i));
    expect(screen.getByText(/6066-7729/i)).toBeDefined();

    // 2. 닫기 (재클릭)
    fireEvent.click(screen.getByText(/애플/i));
    expect(screen.queryByText(/6066-7729/i)).toBeNull();

    // 3. 다시 펼쳐놓은 상태에서 상위 레벨로 이동 시 초기화 테스트
    fireEvent.click(screen.getByText(/애플/i));
    expect(screen.getByText(/6066-7729/i)).toBeDefined();

    // Breadcrumb의 '주식' 클릭하여 상위(중분류)로 이동
    const breadcrumbMajor = screen.getByTestId('breadcrumb-major');
    fireEvent.click(breadcrumbMajor);

    // 다시 '해외주식'을 클릭하여 종목 진입 시 아코디언이 초기화되어 닫혀 있어야 함
    fireEvent.click(screen.getByText('해외주식'));
    expect(screen.queryByText(/6066-7729/i)).toBeNull();
  });

  it('소분류 단계에서 여러 개의 자산을 클릭하면 이전 펼쳐진 자산이 닫히지 않고 동시에 모두 노출된다', () => {
    const multiMockHierarchy = [
      {
        category_name: '주식',
        category_type: 'major',
        current_value: 50000000,
        current_ratio: 100.0,
        children: [
          {
            category_name: '해외주식',
            category_type: 'sub',
            current_value: 50000000,
            current_ratio: 100.0,
            children: [
              { 
                name: '애플', 
                ticker: 'AAPL', 
                valuation_krw: 30000000, 
                current_ratio: 60.0, 
                accounts: [
                  { account_id: 3, account_name: '6066-7729', provider: '키움', alias: '연금', quantity: 50, valuation_krw: 30000000 }
                ]
              },
              { 
                name: '마이크로소프트', 
                ticker: 'MSFT', 
                valuation_krw: 20000000, 
                current_ratio: 40.0, 
                accounts: [
                  { account_id: 4, account_name: '1234-5678', provider: '미래', alias: '일반', quantity: 20, valuation_krw: 20000000 }
                ]
              }
            ]
          }
        ]
      }
    ];

    vi.mocked(useRatios).mockReturnValue({
      hierarchy: multiMockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' 클릭 -> '해외주식' 클릭
    fireEvent.click(screen.getByText('주식'));
    fireEvent.click(screen.getByText('해외주식'));

    // 두 종목 모두 노출 확인
    expect(screen.getByText(/애플/i)).toBeDefined();
    expect(screen.getByText(/마이크로소프트/i)).toBeDefined();

    // 처음에 아코디언은 둘 다 닫혀 있음
    expect(screen.queryByText(/6066-7729/i)).toBeNull();
    expect(screen.queryByText(/1234-5678/i)).toBeNull();

    // '애플' 클릭 -> '애플' 계좌 열림
    fireEvent.click(screen.getByText(/애플/i));
    expect(screen.getByText(/6066-7729/i)).toBeDefined();
    expect(screen.queryByText(/1234-5678/i)).toBeNull();

    // '마이크로소프트' 클릭 -> '마이크로소프트' 계좌도 함께 열림 (이전 '애플'이 닫히지 않고 둘 다 열림)
    fireEvent.click(screen.getByText(/마이크로소프트/i));
    expect(screen.getByText(/6066-7729/i)).toBeDefined();
    expect(screen.getByText(/1234-5678/i)).toBeDefined();
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

  it('소분류 단계에서 계좌 정보가 렌더링될 때 계좌별 평가액이 큰 순서대로 내림차순 정렬된다', () => {
    const sortMockHierarchy = [
      {
        category_name: '주식',
        category_type: 'major',
        current_value: 50000000,
        children: [
          {
            category_name: '해외주식',
            category_type: 'sub',
            current_value: 50000000,
            children: [
              { 
                name: '애플', 
                ticker: 'AAPL', 
                valuation_krw: 50000000, 
                accounts: [
                  { account_id: 3, account_name: '소액계좌', provider: '키움', alias: '연금', quantity: 10, valuation_krw: 10000000 },
                  { account_id: 4, account_name: '고액계좌', provider: '미래', alias: '개인', quantity: 40, valuation_krw: 40000000 }
                ]
              }
            ]
          }
        ]
      }
    ];

    vi.mocked(useRatios).mockReturnValue({
      hierarchy: sortMockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn()
    });

    renderComponent();

    // '주식' -> '해외주식' -> '애플' 클릭
    fireEvent.click(screen.getByText('주식'));
    fireEvent.click(screen.getByText('해외주식'));
    fireEvent.click(screen.getByText(/애플/i));

    // 고액계좌가 소액계좌보다 먼저 렌더링되어야 함.
    const elementHigh = screen.getByText('고액계좌(개인)');
    const elementLow = screen.getByText('소액계좌(연금)');
    
    // DOM 위치 비교 (고액계좌 다음 위치에 소액계좌가 나타나야 함)
    const comparisonResult = elementHigh.compareDocumentPosition(elementLow);
    expect(comparisonResult & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('투자 계산기 탭으로 전환 시 계산기 UI가 렌더링되고 비중 계산이 정상 작동한다', async () => {
    const mockUpdateTargets = vi.fn();
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
      updateTargets: mockUpdateTargets
    });

    renderComponent();

    // 1. 투자 계산기 탭 클릭
    const calcTab = screen.getByText('투자 계산기');
    fireEvent.click(calcTab);

    // 투자금 입력창과 목표 설정이 나타나는지 확인
    expect(screen.getByText('포트폴리오 추가 투자금 입력')).toBeDefined();
    expect(screen.getByText('전체 자산 목표 비중 설정')).toBeDefined();

    // 2. 추가 투자금 입력 (예: 50,000,000원 추가)
    const cashInput = screen.getByTestId('additional-cash-input');
    fireEvent.change(cashInput, { target: { value: '50000000' } });

    // 3. 목표 비중 수정 (주식을 60%, 현금을 40%로 설정)
    const inputs = screen.getAllByRole('spinbutton');
    // inputs[0]은 투자금 입력창, inputs[1]은 주식 목표 비중, inputs[2]는 현금 목표 비중
    fireEvent.change(inputs[1], { target: { value: '60' } });
    fireEvent.change(inputs[2], { target: { value: '40' } });

    // 4. 리밸런싱 가이드 텍스트 업데이트 검증
    // 전체 자산: 1억 + 5천만 = 1억 5천만
    // 주식 목표 (60%): 9천만 -> 현재 5천만 대비 4천만 추가 매수 필요
    // 현금 목표 (40%): 6천만 -> 현재 5천만 대비 1천만 추가 매수 필요
    expect(screen.getByText(/추가 매수: \+40,000,000원/i)).toBeDefined();
    expect(screen.getByText(/추가 매수: \+10,000,000원/i)).toBeDefined();

    // 5. 비중의 합이 100%이므로 저장 버튼이 활성화되어 있어야 함
    const saveButton = screen.getByRole('button', { name: /목표 비중 저장/i });
    expect(saveButton.disabled).toBe(false);

    // 6. 저장 버튼 클릭 시 updateTargets API 호출 형태 검증
    fireEvent.click(saveButton);
    expect(mockUpdateTargets).toHaveBeenCalled();
  });

  it('비중 합계가 100%가 아니면 저장이 불활성화되고, 자동채우기 시 비중이 100%로 보정된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
      updateTargets: vi.fn()
    });

    renderComponent();

    const calcTab = screen.getByText('투자 계산기');
    fireEvent.click(calcTab);

    const inputs = screen.getAllByRole('spinbutton');
    // 주식을 70%로 설정하고 현금은 그대로 둔다 (기존 mockHierarchy의 target_percentage가 50일 것임)
    fireEvent.change(inputs[1], { target: { value: '70' } });
    
    const saveButton = screen.getByRole('button', { name: /목표 비중 저장/i });
    
    // 비중 합이 100%가 아니면(70 + 50 = 120%) 저장 버튼 비활성화 및 경고 노출
    expect(saveButton.disabled).toBe(true);
    expect(screen.getByText(/비중 합계가 정확히 100%여야 저장이 활성화됩니다/i)).toBeDefined();

    // '현금' 항목의 자동채우기 버튼 클릭 (현금의 목표 비중을 100 - 70 = 30%로 강제 보정)
    const autoFillButtons = screen.getAllByText('자동채우기');
    fireEvent.click(autoFillButtons[1]);

    // 이제 비중의 합이 100%이므로 저장 버튼 활성화
    expect(saveButton.disabled).toBe(false);
  });

  it('투자 계산기 탭 전환 시 가로 2분할 레이아웃이 적용되어 두 개의 독립된 차트(현재 비중, 목표 비중)가 각각 렌더링된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
      updateTargets: vi.fn()
    });

    renderComponent();

    // 투자 계산기 탭 클릭
    const calcTab = screen.getByText('투자 계산기');
    fireEvent.click(calcTab);

    // 개선 후 추가할 현재/목표 자산 비중 안내 라벨이 노출되는지 검증
    expect(screen.getByText(/현재 자산 비중/i)).toBeDefined();
    expect(screen.getByText(/목표 자산 비중/i)).toBeDefined();
  });

  it('하위 레벨(대분류 클릭 후 중분류) 진입 시 고대비 멀티컬러 팔레트가 적용되어 색상들이 구분 가능하게 지정된다', () => {
    vi.mocked(useRatios).mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
      updateTargets: vi.fn()
    });

    renderComponent();

    // '주식' 클릭 -> 중분류 진입
    fireEvent.click(screen.getByText('주식'));

    // listData에서 국내주식과 해외주식의 색상을 찾기 위해 data-testid="ratio-row" 내의 색상 표시 원을 검증
    const rowColors = screen.getAllByTestId('ratio-row');
    
    const firstColorSpan = rowColors[0].querySelector('span');
    const secondColorSpan = rowColors[1].querySelector('span');
    
    expect(firstColorSpan).not.toBeNull();
    expect(secondColorSpan).not.toBeNull();

    // 두 색상은 대분류 브랜드 톤과 다른 고대비 색상으로 각각 할당되어 서로 달라야 함
    const firstColor = firstColorSpan.style.backgroundColor;
    const secondColor = secondColorSpan.style.backgroundColor;
    
    expect(firstColor).not.toBe(secondColor);
  });
});
