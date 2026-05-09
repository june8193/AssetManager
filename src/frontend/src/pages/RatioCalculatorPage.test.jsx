import { describe, it, expect } from 'vitest';
import { calculateRealtimeRebalancing } from './RatioCalculatorPage';

describe('calculateRealtimeRebalancing', () => {
  const mockHierarchy = [
    {
      category_name: '주식',
      category_type: 'major',
      current_value: 1000000,
      target_percentage: 60,
      children: [
        {
          category_name: '미국주식',
          category_type: 'sub',
          current_value: 600000,
          target_percentage: 70, // 대분류 내 비중
          children: [
            { ticker: 'AAPL', name: '애플', valuation_krw: 400000, target_percentage: 50 }, // 미국주식 내 50%
            { ticker: 'MSFT', name: '마이크로소프트', valuation_krw: 200000, target_percentage: 50 } // 미국주식 내 50%
          ]
        },
        {
          category_name: '한국주식',
          category_type: 'sub',
          current_value: 400000,
          target_percentage: 30, // 대분류 내 비중
          children: [
            { ticker: '005930', name: '삼성전자', valuation_krw: 400000, target_percentage: 100 }
          ]
        }
      ]
    },
    {
      category_name: '현금',
      category_type: 'major',
      current_value: 1000000,
      target_percentage: 40,
      children: []
    }
  ];

  it('추가 투자금이 0일 때 리밸런싱을 정확히 계산한다', () => {
    const additionalCash = 0;
    const result = calculateRealtimeRebalancing(mockHierarchy, additionalCash);

    // 전체 자산: 1,000,000 + 1,000,000 = 2,000,000
    // 주식 목표 (60%): 1,200,000
    // 주식 차액: 1,200,000 - 1,000,000 = +200,000
    expect(result[0].target_amt).toBe(1200000);
    expect(result[0].diff_amt).toBe(200000);

    // 미국주식 목표 (주식의 70%): 1,200,000 * 0.7 = 840,000
    // 미국주식 차액: 840,000 - 600,000 = +240,000
    const usStock = result[0].children.find(c => c.category_name === '미국주식');
    expect(usStock.target_amt).toBe(840000);
    expect(usStock.diff_amt).toBe(240000);

    // 애플 목표 (미국주식 목표의 50%): 840,000 * 0.5 = 420,000
    // 애플 차액: 420,000 - 400,000 = 20,000
    const aaplNode = usStock.children.find(c => c.ticker === 'AAPL');
    expect(aaplNode.target_amt).toBe(420000);
    expect(aaplNode.diff_amt).toBe(20000);
  });

  it('추가 투자금이 있을 때 리밸런싱을 정확히 계산한다', () => {
    const additionalCash = 1000000;
    const result = calculateRealtimeRebalancing(mockHierarchy, additionalCash);

    // 전체 자산: 2,000,000 + 1,000,000 = 3,000,000
    // 주식 목표 (60%): 1,800,000
    // 주식 차액: 1,800,000 - 1,000,000 = +800,000
    expect(result[0].target_amt).toBe(1800000);
    expect(result[0].diff_amt).toBe(800000);
  });
});
