import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileMddSummaryCard from './MobileMddSummaryCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileMddSummaryCard', () => {
  const mockIndicesMdd = {
    'S&P 500': -5.42,
    'NASDAQ': -8.15,
    'KOSPI': -4.30,
    'KOSDAQ': -10.25,
  };

  it('헤드라인에 내 포트폴리오 수익률과 MDD가 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileMddSummaryCard
          portfolioReturn={12.45}
          portfolioMdd={-3.82}
          indicesMdd={mockIndicesMdd}
          isMasked={false}
        />
      </MaskingProvider>
    );

    // 포트폴리오 수익률 및 MDD 표시 확인
    const returnEl = screen.getByTestId('masked-return');
    expect(returnEl).toHaveTextContent('+12.45%');

    const mddEl = screen.getByTestId('portfolio-mdd-value');
    expect(mddEl).toHaveTextContent('-3.82%');
  });

  it('하위 4열 그리드에 4대 지수 MDD가 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileMddSummaryCard
          portfolioReturn={12.45}
          portfolioMdd={-3.82}
          indicesMdd={mockIndicesMdd}
          isMasked={false}
        />
      </MaskingProvider>
    );

    expect(screen.getByTestId('index-mdd-sp500')).toHaveTextContent('-5.42%');
    expect(screen.getByTestId('index-mdd-nasdaq')).toHaveTextContent('-8.15%');
    expect(screen.getByTestId('index-mdd-kospi')).toHaveTextContent('-4.30%');
    expect(screen.getByTestId('index-mdd-kosdaq')).toHaveTextContent('-10.25%');
  });

  it('isMasked가 true일 때 포트폴리오 수익률 수치가 마스킹(***)되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileMddSummaryCard
          portfolioReturn={12.45}
          portfolioMdd={-3.82}
          indicesMdd={mockIndicesMdd}
          isMasked={true}
        />
      </MaskingProvider>
    );

    const returnEl = screen.getByTestId('masked-return');
    expect(returnEl).toHaveTextContent('***');
    // 지수 MDD는 마스킹되지 않고 그대로 유지
    expect(screen.getByTestId('index-mdd-sp500')).toHaveTextContent('-5.42%');
  });

  it('수익률이나 MDD가 null/undefined일 때 기본 플레이스홀더(-)가 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileMddSummaryCard
          portfolioReturn={null}
          portfolioMdd={null}
          indicesMdd={{}}
          isMasked={false}
        />
      </MaskingProvider>
    );

    const returnEl = screen.getByTestId('masked-return');
    expect(returnEl).toHaveTextContent('-');

    const mddEl = screen.getByTestId('portfolio-mdd-value');
    expect(mddEl).toHaveTextContent('-');

    expect(screen.getByTestId('index-mdd-sp500')).toHaveTextContent('-');
  });
});
