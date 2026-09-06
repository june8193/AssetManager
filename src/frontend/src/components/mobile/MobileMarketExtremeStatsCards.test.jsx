import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileMarketExtremeStatsCards, { calculateExtremeStats } from './MobileMarketExtremeStatsCards';

describe('MobileMarketExtremeStatsCards', () => {
  const mockChartData = [
    { date: '2024-08-01', value: 5446.68, mdd: -2.3, vix: 16.36 },
    { date: '2024-08-05', value: 5186.33, mdd: -8.5, vix: 38.57 }, // VIX 피크 (공포 정점)
    { date: '2024-08-06', value: 5240.03, mdd: -10.2, vix: 27.71 }, // MDD 바닥 (최대 낙폭)
    { date: '2024-08-07', value: 5319.31, mdd: -6.4, vix: 22.96 },
  ];

  describe('calculateExtremeStats 계산 함수 검증', () => {
    it('null 또는 빈 배열 전달 시 null을 반환한다', () => {
      expect(calculateExtremeStats(null)).toBeNull();
      expect(calculateExtremeStats(undefined)).toBeNull();
      expect(calculateExtremeStats([])).toBeNull();
    });

    it('기간 내 VIX 피크(최고치)와 MDD 바닥(최저치) 시점 및 당시 수치들을 올바르게 산출한다', () => {
      const stats = calculateExtremeStats(mockChartData);

      expect(stats).not.toBeNull();

      // VIX 피크 검증 (2024-08-05: VIX 38.57, MDD -8.5%, 가격 5186.33)
      expect(stats.maxVix).toBeDefined();
      expect(stats.maxVix.date).toBe('2024-08-05');
      expect(stats.maxVix.vix).toBe(38.57);
      expect(stats.maxVix.mdd).toBe(-8.5);
      expect(stats.maxVix.value).toBe(5186.33);

      // MDD 바닥 검증 (2024-08-06: MDD -10.2%, VIX 27.71, 가격 5240.03)
      expect(stats.worstMdd).toBeDefined();
      expect(stats.worstMdd.date).toBe('2024-08-06');
      expect(stats.worstMdd.mdd).toBe(-10.2);
      expect(stats.worstMdd.vix).toBe(27.71);
      expect(stats.worstMdd.value).toBe(5240.03);
    });

    it('null, undefined, NaN 등의 비정상 데이터가 포함되어 있어도 정상 항목 중 극단값을 올바르게 선별한다', () => {
      const noisyData = [
        { date: '2024-01-01', value: null, mdd: null, vix: null },
        { date: '2024-01-02', value: 5000, mdd: -3.0, vix: 20.0 },
        { date: '2024-01-03', value: 4800, mdd: -7.0, vix: NaN },
        { date: '2024-01-04', value: 4900, mdd: undefined, vix: 25.0 },
      ];

      const stats = calculateExtremeStats(noisyData);
      expect(stats.maxVix.vix).toBe(25.0);
      expect(stats.maxVix.date).toBe('2024-01-04');
      expect(stats.worstMdd.mdd).toBe(-7.0);
      expect(stats.worstMdd.date).toBe('2024-01-03');
    });
  });

  describe('컴포넌트 렌더링 검증', () => {
    it('데이터가 없으면 null을 렌더링한다', () => {
      const { container } = render(<MobileMarketExtremeStatsCards chartData={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 카드가 올바른 날짜와 수치로 렌더링된다', () => {
      render(<MobileMarketExtremeStatsCards chartData={mockChartData} />);

      // 컨테이너 렌더링 확인
      expect(screen.getByTestId('extreme-stats-cards-container')).toBeInTheDocument();

      // 1. 최대 공포 (VIX 피크) 카드 검증
      const maxVixCard = screen.getByTestId('extreme-card-max-vix');
      expect(maxVixCard).toBeInTheDocument();
      expect(screen.getByText('기간 내 최대 공포 (VIX 피크)')).toBeInTheDocument();
      expect(maxVixCard).toHaveTextContent('2024-08-05');
      expect(maxVixCard).toHaveTextContent('38.57');
      expect(maxVixCard).toHaveTextContent('-8.50%');
      expect(maxVixCard).toHaveTextContent('5,186.3 pt');

      // 2. 최대 낙폭 (MDD 바닥) 카드 검증
      const worstMddCard = screen.getByTestId('extreme-card-worst-mdd');
      expect(worstMddCard).toBeInTheDocument();
      expect(screen.getByText('기간 내 최대 낙폭 (MDD 바닥)')).toBeInTheDocument();
      expect(worstMddCard).toHaveTextContent('2024-08-06');
      expect(worstMddCard).toHaveTextContent('-10.20%');
      expect(worstMddCard).toHaveTextContent('27.71');
      expect(worstMddCard).toHaveTextContent('5,240.0 pt');
    });
  });
});
