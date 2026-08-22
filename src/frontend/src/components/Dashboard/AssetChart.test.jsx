import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AssetChart from './AssetChart';
import { MaskingProvider } from '../../contexts/MaskingContext';


describe('AssetChart 컴포넌트', () => {
  const mockData = {
    history: [
      { date: '2024-01-01', total: 1000000, acc_1: 1000000 },
      { date: '2024-01-02', total: 1100000, acc_1: 1100000 },
    ],
    accounts: [
      { id: 1, name: '테스트 계좌' }
    ]
  };

  it('차트 제목과 필터가 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );
    expect(screen.getByText('자산 추이')).toBeInTheDocument();
    expect(screen.getByText('총 자산 합계')).toBeInTheDocument();
  });

  it('데이터가 없을 때 안내 메시지를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={{ history: [], accounts: [] }} />
      </MaskingProvider>
    );
    expect(screen.getByText('표시할 자산 추이 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('필터를 변경하면 텍스트가 업데이트되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: 'acc_1' } });
    
    expect(screen.getByText(/시간에 따른 자산 평가액 변화 \(테스트 계좌\)/)).toBeInTheDocument();
  });
});
