import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DailyStatusTable from './DailyStatusTable';
import { MaskingProvider } from '../contexts/MaskingContext';

describe('DailyStatusTable', () => {
  const mockData = [
    {
      date: '2024-01-03',
      contribution: 0,
      profit: -300,
      roi: -7.5,
      assets: 3700,
      increase: -300
    },
    {
      date: '2024-01-02',
      contribution: 500,
      profit: 500,
      roi: 14.29,
      assets: 4000,
      increase: 1000
    },
    {
      date: '2024-01-01',
      contribution: 3000,
      profit: 0,
      roi: 0,
      assets: 3000,
      increase: 3000
    }
  ];

  // 12개 데이터를 만들어서 페이지네이션을 테스트하기 위한 데이터셋
  const generateMockData = (count) => {
    return Array.from({ length: count }, (_, idx) => {
      const day = String(count - idx).padStart(2, '0');
      return {
        date: `2024-01-${day}`,
        contribution: 100,
        profit: 10,
        roi: 1,
        assets: 1000 + (count - idx) * 10,
        increase: 10
      };
    });
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('가장 최초 일자의 자산 증가액은 "-"로 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <DailyStatusTable data={mockData} />
      </MaskingProvider>
    );
    
    const rows = screen.getAllByRole('row');
    // rows[0]은 thead이므로
    // rows[1]: 2024-01-03
    // rows[2]: 2024-01-02
    // rows[3]: 2024-01-01 (마지막/최초 데이터)
    
    const row03 = rows[1];
    expect(row03).toHaveTextContent('2024-01-03');
    expect(row03).toHaveTextContent('-300'); // increase 표시
    
    const row01 = rows[3];
    expect(row01).toHaveTextContent('2024-01-01');
    expect(row01).toHaveTextContent('-'); // increase 대신 '-' 표시
  });

  it('데이터가 10개 이하일 때 페이지네이션 컨트롤이 표시되지 않아야 한다', () => {
    render(
      <MaskingProvider>
        <DailyStatusTable data={mockData} />
      </MaskingProvider>
    );

    expect(screen.queryByLabelText('이전 페이지')).not.toBeInTheDocument();
  });

  it('데이터가 10개 초과일 때 페이지네이션 컨트롤이 표시되고 페이지 전환이 동작해야 한다', () => {
    const largeData = generateMockData(12); // 12개 아이템 (1페이지 10개, 2페이지 2개)
    render(
      <MaskingProvider>
        <DailyStatusTable data={largeData} />
      </MaskingProvider>
    );

    // 1페이지에는 10개만 보여야 함
    // headers row(1) + data rows(10) = 11 rows
    expect(screen.getAllByRole('row')).toHaveLength(11);
    
    // '2024-01-12' (첫 아이템)은 보이지만, '2024-01-01' (마지막 아이템)은 보이지 않아야 함
    expect(screen.getByText('2024-01-12')).toBeInTheDocument();
    expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();

    // 다음 페이지 버튼 클릭
    const nextBtn = screen.getByLabelText('다음 페이지');
    fireEvent.click(nextBtn);

    // 2페이지에는 2개만 보여야 함
    // headers row(1) + data rows(2) = 3 rows
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByText('2024-01-12')).not.toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });

  it('마스킹 모드가 활성화되면 금액 정보가 "***"로 표시되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');
    
    render(
      <MaskingProvider>
        <DailyStatusTable data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getAllByText(/₩ \*\*\*/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+\*\*\*/).length).toBeGreaterThan(0);
    
    // 수익률(roi)은 숫자로 표시
    expect(screen.getByText('-7.5%')).toBeInTheDocument();
  });
});
