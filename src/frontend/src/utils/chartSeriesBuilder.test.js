import { describe, it, expect } from 'vitest';
import { buildLiveAssetSnapshots } from './chartSeriesBuilder';

describe('buildLiveAssetSnapshots 유틸리티 테스트', () => {
  it('snapshots 또는 history가 비어 있으면 빈 history 배열을 유지한다', () => {
    expect(buildLiveAssetSnapshots(null, { total_valuation_krw: 1000 }, '2024-01-10')).toEqual({
      history: [],
      accounts: [],
    });

    expect(
      buildLiveAssetSnapshots({ history: [], accounts: [{ id: 1, name: '계좌1' }] }, { total_valuation_krw: 1000 }, '2024-01-10')
    ).toEqual({
      history: [],
      accounts: [{ id: 1, name: '계좌1' }],
    });
  });

  it('마지막 스냅샷 날짜가 오늘보다 이전(lastSnap.date < todayStr)이면 맨 끝에 실시간(is_live: true) 포인트를 추가한다', () => {
    const snapshots = {
      history: [
        {
          date: '2024-01-01',
          total: 3000,
          period_deposit: 3000,
          index: 1000.0,
          index_change_pct: 0.0,
          index_cum_return_pct: 0.0,
          acc_1: 1000,
          acc_2: 2000,
        },
        {
          date: '2024-01-02',
          total: 4000,
          period_deposit: 500,
          index: 1142.86,
          index_change_pct: 14.29,
          index_cum_return_pct: 14.29,
          acc_1: 1500,
          acc_2: 2500,
        },
      ],
      accounts: [
        { id: 1, name: '계좌1' },
        { id: 2, name: '계좌2' },
      ],
    };

    // 마지막 스냅샷(4000) 이후 오늘(2024-01-05):
    // 미반영 입금 pending_deposits_krw = 1000
    // 오늘 실시간 총평가액 = 5500 (계좌1: 2000, 계좌2: 3500)
    // increase = 5500 - 4000 = 1500, profit = 1500 - 1000 = 500
    // base = 4000 + 1000 = 5000
    // r_live = 500 / 5000 = 0.10 (10.0%)
    // live_raw_index = 1142.86 * (1 + 0.10) = 1257.146 -> index = 1257.15
    // index_change_pct = 10.0
    // index_cum_return_pct = ((1257.146 - 1000) / 1000) * 100 = 25.7146 -> 25.71
    const summary = {
      total_valuation_krw: 5500,
      pending_deposits_krw: 1000,
      accounts: [
        { id: 1, name: '계좌1', total_valuation_krw: 2000 },
        { id: 2, name: '계좌2', total_valuation_krw: 3500 },
      ],
    };

    const result = buildLiveAssetSnapshots(snapshots, summary, '2024-01-05');

    expect(result.history).toHaveLength(3);
    const livePoint = result.history[2];
    expect(livePoint).toEqual({
      date: '2024-01-05',
      total: 5500,
      period_deposit: 1000,
      index: 1257.15,
      index_change_pct: 10.0,
      index_cum_return_pct: 25.71,
      acc_1: 2000,
      acc_2: 3500,
      is_live: true,
    });
  });

  it('오늘 이미 스냅샷이 존재하는 경우(lastSnap.date === todayStr) 중복 포인트를 추가하지 않고 마지막 항목을 최신 실시간 값으로 갱신한다', () => {
    //Case 2a: 다중 스냅샷 중 마지막이 오늘인 경우
    const snapshots = {
      history: [
        {
          date: '2024-01-01',
          total: 3000,
          period_deposit: 3000,
          index: 1000.0,
          index_change_pct: 0.0,
          index_cum_return_pct: 0.0,
          acc_1: 1000,
          acc_2: 2000,
        },
        {
          date: '2024-01-05',
          total: 4000,
          period_deposit: 500,
          index: 1142.86,
          index_change_pct: 14.29,
          index_cum_return_pct: 14.29,
          acc_1: 1500,
          acc_2: 2500,
        },
      ],
      accounts: [
        { id: 1, name: '계좌1' },
        { id: 2, name: '계좌2' },
      ],
    };

    // 오늘 스냅샷 찍은 이후 장중 시세 변동으로 총자산이 4350으로 증가하고 미반영 추가 입금 500 발생
    // 당일 누적 입출금 = 기존 스냅샷 period_deposit(500) + pending_deposits_krw(500) = 1000
    // 직전 스냅샷(2024-01-01, total=3000, index=1000.0) 대비:
    // increase = 4350 - 3000 = 1350, profit = 1350 - 1000 = 350
    // base = 3000 + 1000 = 4000
    // r_live = 350 / 4000 = 0.0875 (8.75%)
    // live_raw_index = 1000.0 * (1 + 0.0875) = 1087.5 -> index = 1087.5, change = 8.75, cum = 8.75
    const summary = {
      total_valuation_krw: 4350,
      pending_deposits_krw: 500,
      accounts: [
        { id: 1, name: '계좌1', total_valuation_krw: 1650 },
        { id: 2, name: '계좌2', total_valuation_krw: 2700 },
      ],
    };

    const result = buildLiveAssetSnapshots(snapshots, summary, '2024-01-05');

    expect(result.history).toHaveLength(2);
    expect(result.history[1]).toEqual({
      date: '2024-01-05',
      total: 4350,
      period_deposit: 1000,
      index: 1087.5,
      index_change_pct: 8.75,
      index_cum_return_pct: 8.75,
      acc_1: 1650,
      acc_2: 2700,
      is_live: true,
    });
  });

  it('유일한 첫 스냅샷이 오늘 날짜(history.length === 1 && lastSnap.date === todayStr)인 경우 당일 스냅샷 대비 실시간 변동을 반영하여 갱신한다', () => {
    const snapshots = {
      history: [
        {
          date: '2024-01-05',
          total: 3000,
          period_deposit: 3000,
          index: 1000.0,
          index_change_pct: 0.0,
          index_cum_return_pct: 0.0,
          acc_1: 3000,
        },
      ],
      accounts: [{ id: 1, name: '계좌1' }],
    };

    // 첫 스냅샷(3000) 찍은 당일 시세가 3300으로 상승 (미반영 입금 0)
    // r_live = (3300 - 3000 - 0) / (3000 + 0) = 0.10 (10%)
    // index = 1100.0, change = 10.0, cum = 10.0
    const summary = {
      total_valuation_krw: 3300,
      pending_deposits_krw: 0,
      accounts: [{ id: 1, name: '계좌1', total_valuation_krw: 3300 }],
    };

    const result = buildLiveAssetSnapshots(snapshots, summary, '2024-01-05');

    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toEqual({
      date: '2024-01-05',
      total: 3300,
      period_deposit: 3000,
      index: 1100.0,
      index_change_pct: 10.0,
      index_cum_return_pct: 10.0,
      acc_1: 3300,
      is_live: true,
    });
  });
});
