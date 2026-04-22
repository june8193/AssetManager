import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import YearlyStatusTable from './YearlyStatusTable';

describe('YearlyStatusTable', () => {
  const mockData = [
    {
      year: 2023,
      contribution: 1000,
      profit: 200,
      roi: 20,
      assets: 1200,
      increase: 200
    },
    {
      year: 2022,
      contribution: 1000,
      profit: 100,
      roi: 10,
      assets: 1000,
      increase: 100
    }
  ];

  it('최신 연도가 상단에 표시될 때, 가장 마지막(최초) 연도의 자산 증가액은 "-"로 표시되어야 한다', () => {
    render(<YearlyStatusTable data={mockData} />);
    
    const rows = screen.getAllByRole('row');
    // rows[0]은 thead이므로 rows[1]이 2023년, rows[2]가 2022년
    
    // 2023년 행 (index 0)
    const row2023 = rows[1];
    expect(row2023).toHaveTextContent('2023');
    expect(row2023).toHaveTextContent('+200'); // increase가 표시되어야 함
    
    // 2022년 행 (index 1, 마지막 항목)
    const row2022 = rows[2];
    expect(row2022).toHaveTextContent('2022');
    expect(row2022).toHaveTextContent('-'); // increase 대신 '-'가 표시되어야 함
  });

  it('데이터가 하나만 있을 경우 해당 연도의 자산 증가액은 "-"로 표시되어야 한다', () => {
    const singleData = [mockData[0]];
    render(<YearlyStatusTable data={singleData} />);
    
    const rows = screen.getAllByRole('row');
    const row2023 = rows[1];
    expect(row2023).toHaveTextContent('2023');
    expect(row2023).toHaveTextContent('-');
  });
});
