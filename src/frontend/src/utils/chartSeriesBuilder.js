/**
 * 스냅샷 시계열과 실시간 대시보드 요약 데이터를 결합하여 차트용 시계열을 생성하는 유틸리티 모듈입니다.
 */

const roundToTwo = (val) => Math.round((val + Number.EPSILON) * 100) / 100;

/**
 * 직전 기준 자산·지수와 실시간 평가액·입출금을 바탕으로 실시간(Live) 차트 데이터 포인트를 생성합니다.
 *
 * @param {Object} params
 * @param {Object} [params.baseItem={}] - 기존 스냅샷 항목 속성(덮어쓰기용 기본 객체)
 * @param {string} params.date - 포인트 날짜 ('YYYY-MM-DD')
 * @param {number} params.liveTotal - 실시간 총 평가액
 * @param {number} params.prevTotal - 구간 수익률 계산용 직전 총 평가액
 * @param {number} params.prevIndex - 구간 수익률 연쇄 계산용 직전 지수
 * @param {number} params.calcDeposit - 구간 수익률 계산에 반영할 입출금액
 * @param {number} params.displayDeposit - 결과 객체의 period_deposit에 기록할 입출금액
 * @param {Object} params.accountValuations - 계좌별 실시간 평가액 맵 ({ acc_1: number, ... })
 * @returns {Object} 실시간 시계열 포인트 객체
 */
const createLiveSnapshotPoint = ({
  baseItem = {},
  date,
  liveTotal,
  prevTotal,
  prevIndex,
  calcDeposit,
  displayDeposit,
  accountValuations,
}) => {
  const increase = liveTotal - prevTotal;
  const profit = increase - calcDeposit;
  const base = prevTotal + calcDeposit;
  const rLive = base !== 0 ? profit / base : 0.0;
  const liveRawIndex = prevIndex * (1.0 + rLive);

  return {
    ...baseItem,
    date,
    total: liveTotal,
    period_deposit: displayDeposit,
    index: roundToTwo(liveRawIndex),
    index_change_pct: roundToTwo(rLive * 100.0),
    index_cum_return_pct: roundToTwo(((liveRawIndex - 1000.0) / 1000.0) * 100.0),
    ...accountValuations,
    is_live: true,
  };
};

/**
 * 오늘 날짜를 로컬 기준 'YYYY-MM-DD' 형식 문자열로 반환합니다.
 *
 * @param {Date} [now=new Date()] - 기준 시각
 * @returns {string} 'YYYY-MM-DD' 형식 날짜 문자열
 */
export const getLocalTodayStr = (now = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 스냅샷 시계열(snapshots.history)과 실시간 대시보드 요약(summary)을 병합하여
 * 차트 맨 끝점에 오늘의 실시간(Live) 자산 및 실시간 수익 지수를 반영합니다.
 *
 * @param {Object} snapshots - 백엔드 get_snapshots 응답 ({ history: Array, accounts: Array })
 * @param {Object} summary - 백엔드 get_dashboard_summary 응답 ({ total_valuation_krw, pending_deposits_krw, accounts })
 * @param {string} [todayStr=getLocalTodayStr()] - 오늘 날짜 ('YYYY-MM-DD')
 * @returns {Object} 실시간 끝점이 병합된 snapshots 객체 ({ history: Array, accounts: Array })
 */
export const buildLiveAssetSnapshots = (snapshots, summary, todayStr = getLocalTodayStr()) => {
  if (!snapshots || !Array.isArray(snapshots.history) || snapshots.history.length === 0) {
    return {
      ...(snapshots || {}),
      history: [],
      accounts: snapshots?.accounts || [],
    };
  }

  if (!summary || typeof summary.total_valuation_krw !== 'number') {
    return snapshots;
  }

  const history = snapshots.history.map((item) => ({ ...item }));
  const lastIdx = history.length - 1;
  const lastSnap = history[lastIdx];

  const liveTotal = summary.total_valuation_krw;
  const pendingDeposits = summary.pending_deposits_krw || 0;

  const accountValuations = {};
  if (Array.isArray(summary.accounts)) {
    for (const acc of summary.accounts) {
      if (acc && acc.id !== undefined) {
        accountValuations[`acc_${acc.id}`] = acc.total_valuation_krw || 0;
      }
    }
  }

  // Case 1: 마지막 스냅샷 날짜가 오늘보다 이전인 경우 -> 맨 끝에 오늘의 실시간 포인트 추가
  if (lastSnap.date < todayStr) {
    const livePoint = createLiveSnapshotPoint({
      date: todayStr,
      liveTotal,
      prevTotal: lastSnap.total || 0,
      prevIndex: lastSnap.index ?? 1000.0,
      calcDeposit: pendingDeposits,
      displayDeposit: pendingDeposits,
      accountValuations,
    });

    return {
      ...snapshots,
      history: [...history, livePoint],
    };
  }

  // Case 2: 오늘 이미 스냅샷을 생성한 경우 (lastSnap.date === todayStr) -> 마지막 항목을 최신 실시간 값으로 갱신
  if (lastSnap.date === todayStr) {
    const hasPrevSnap = history.length >= 2;
    const referenceSnap = hasPrevSnap ? history[lastIdx - 1] : lastSnap;
    const displayDeposit = (lastSnap.period_deposit || 0) + pendingDeposits;
    const calcDeposit = hasPrevSnap ? displayDeposit : pendingDeposits;

    history[lastIdx] = createLiveSnapshotPoint({
      baseItem: lastSnap,
      date: todayStr,
      liveTotal,
      prevTotal: referenceSnap.total || 0,
      prevIndex: referenceSnap.index ?? 1000.0,
      calcDeposit,
      displayDeposit,
      accountValuations,
    });

    return {
      ...snapshots,
      history,
    };
  }

  return snapshots;
};
