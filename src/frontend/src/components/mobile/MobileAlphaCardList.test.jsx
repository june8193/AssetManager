import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MobileAlphaCardList from './MobileAlphaCardList';
import { MaskingProvider } from '../../contexts/MaskingContext';

const mockAlphaAnalysis = [
  { benchmark: 'S&P 500', ticker: '^GSPC', benchmark_return: 8.5, portfolio_return: 12.45, alpha: 3.95, judgment: '시장 상회' },
  { benchmark: 'NASDAQ', ticker: '^IXIC', benchmark_return: 14.2, portfolio_return: 12.45, alpha: -1.75, judgment: '시장 하회' },
  { benchmark: 'KOSPI', ticker: '^KS11', benchmark_return: 3.1, portfolio_return: 12.45, alpha: 9.35, judgment: '시장 상회' },
  { benchmark: 'KOSDAQ', ticker: '^KQ11', benchmark_return: -2.4, portfolio_return: 12.45, alpha: 14.85, judgment: '시장 상회' },
];

const mockIndicesMdd = {
  'S&P 500': -5.4,
  'NASDAQ': -8.2,
  'KOSPI': -4.3,
  'KOSDAQ': -10.5,
};

function renderComponent(props = {}) {
  return render(
    <MaskingProvider>
      <MobileAlphaCardList
        alphaAnalysis={mockAlphaAnalysis}
        indicesMdd={mockIndicesMdd}
        portfolioReturn={12.45}
        {...props}
      />
    </MaskingProvider>
  );
}

describe('MobileAlphaCardList', () => {
  it('4대 지수(S&P 500, NASDAQ, KOSPI, KOSDAQ) 컴팩트 카드가 렌더링된다', () => {
    renderComponent();

    expect(screen.getByTestId('alpha-card-sp500')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-card-nasdaq')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-card-kospi')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-card-kosdaq')).toBeInTheDocument();

    // 각 카드의 지수명 확인
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    expect(screen.getByText('NASDAQ')).toBeInTheDocument();
    expect(screen.getByText('KOSPI')).toBeInTheDocument();
    expect(screen.getByText('KOSDAQ')).toBeInTheDocument();
  });

  it('각 카드에 지수 수익률, 내 포트폴리오 수익률, 알파 뱃지가 올바른 서식으로 표시된다', () => {
    renderComponent();

    // S&P 500 카드 (+8.50%, +12.45%, +3.95%p)
    const spCard = screen.getByTestId('alpha-card-sp500');
    expect(spCard).toHaveTextContent('+8.50%');
    expect(spCard).toHaveTextContent('+12.45%');
    expect(spCard).toHaveTextContent('+3.95%p');

    // NASDAQ 카드 (+14.20%, +12.45%, -1.75%p)
    const ndCard = screen.getByTestId('alpha-card-nasdaq');
    expect(ndCard).toHaveTextContent('+14.20%');
    expect(ndCard).toHaveTextContent('+12.45%');
    expect(ndCard).toHaveTextContent('-1.75%p');

    // KOSDAQ 카드 (-2.40%, +12.45%, +14.85%p)
    const kqCard = screen.getByTestId('alpha-card-kosdaq');
    expect(kqCard).toHaveTextContent('-2.40%');
    expect(kqCard).toHaveTextContent('+12.45%');
    expect(kqCard).toHaveTextContent('+14.85%p');
  });

  it('isMasked=true 설정 시 포트폴리오 수익률과 알파 수치가 마스킹된다', () => {
    renderComponent({ isMasked: true });

    const spCard = screen.getByTestId('alpha-card-sp500');
    // 지수 수익률은 마스킹되지 않음
    expect(spCard).toHaveTextContent('+8.50%');
    // 포트폴리오 수익률과 알파는 마스킹됨
    expect(spCard).not.toHaveTextContent('+12.45%');
    expect(spCard).not.toHaveTextContent('+3.95%p');
    expect(spCard).toHaveTextContent('***');
  });

  it('기본 상태에서는 상세 테이블이 접혀있고, 토글 버튼 클릭 시 상세 테이블이 펼쳐진다', () => {
    renderComponent();

    const toggleBtn = screen.getByTestId('alpha-table-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveTextContent('상세 표 보기');
    expect(screen.queryByTestId('alpha-detail-table')).not.toBeInTheDocument();

    // 토글 클릭 -> 펼쳐짐
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveTextContent('상세 표 접기');
    expect(screen.getByTestId('alpha-detail-table')).toBeInTheDocument();

    // 다시 토글 클릭 -> 접힘
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveTextContent('상세 표 보기');
    expect(screen.queryByTestId('alpha-detail-table')).not.toBeInTheDocument();
  });

  it('상세 데이터 테이블에 지수명, 지수 수익률, 내 수익률, 알파, 지수 MDD 컬럼과 행이 올바르게 표시된다', () => {
    renderComponent();

    const toggleBtn = screen.getByTestId('alpha-table-toggle-btn');
    fireEvent.click(toggleBtn);

    const table = screen.getByTestId('alpha-detail-table');
    expect(table).toBeInTheDocument();

    // 테이블 헤더 컬럼 검증
    const tableScope = within(table);
    expect(tableScope.getByText('지수명')).toBeInTheDocument();
    expect(tableScope.getByText('지수 수익률')).toBeInTheDocument();
    expect(tableScope.getByText('내 수익률')).toBeInTheDocument();
    expect(tableScope.getByText('알파')).toBeInTheDocument();
    expect(tableScope.getByText('지수 MDD')).toBeInTheDocument();

    // S&P 500 행 데이터 검증
    const spRow = screen.getByTestId('alpha-table-row-sp500');
    expect(spRow).toHaveTextContent('S&P 500');
    expect(spRow).toHaveTextContent('+8.50%');
    expect(spRow).toHaveTextContent('+12.45%');
    expect(spRow).toHaveTextContent('+3.95%p');
    expect(spRow).toHaveTextContent('-5.40%');

    // NASDAQ 행 데이터 검증
    const ndRow = screen.getByTestId('alpha-table-row-nasdaq');
    expect(ndRow).toHaveTextContent('NASDAQ');
    expect(ndRow).toHaveTextContent('+14.20%');
    expect(ndRow).toHaveTextContent('+12.45%');
    expect(ndRow).toHaveTextContent('-1.75%p');
    expect(ndRow).toHaveTextContent('-8.20%');
  });

  it('상세 테이블에서도 isMasked=true 시 내 수익률과 알파가 마스킹된다', () => {
    renderComponent({ isMasked: true });

    const toggleBtn = screen.getByTestId('alpha-table-toggle-btn');
    fireEvent.click(toggleBtn);

    const spRow = screen.getByTestId('alpha-table-row-sp500');
    expect(spRow).toHaveTextContent('S&P 500');
    expect(spRow).toHaveTextContent('+8.50%');
    expect(spRow).not.toHaveTextContent('+12.45%');
    expect(spRow).not.toHaveTextContent('+3.95%p');
    expect(spRow).toHaveTextContent('-5.40%');
  });

  it('데이터가 비어있을 경우 안내 문구가 표시된다', () => {
    render(
      <MaskingProvider>
        <MobileAlphaCardList alphaAnalysis={[]} />
      </MaskingProvider>
    );

    expect(screen.getByText('초과수익률 비교 데이터가 없습니다.')).toBeInTheDocument();
  });
});
