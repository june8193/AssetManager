import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Receipt,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { expenseService } from '../../services/expenseService';
import useFormatters from '../../hooks/useFormatters';
import { getPastMonth } from '../../components/ExpensePeriodSelector';

const OWNER_OPTIONS = ['전체', '장준', '성은'];
const PRESET_OPTIONS = [
  { id: '1m', label: '당월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
  { id: 'ytd', label: '올해' },
];
const PAGE_SIZE = 100;

/**
 * 모바일 전용 지출 관리 페이지 컴포넌트 (`/m/expenses`)
 * 
 * - 상단 소유주 탭 ('전체', '장준', '성은')
 * - 가로 스크롤 기간 프리셋 칩 ('당월', '3개월', '6개월', '1년', '올해', '직접 지정 🗓')
 * - 모바일 토글형 기간 직접 지정 (시작월, 종료월 드롭다운 및 조회) 패널
 * - 모바일 핵심 KPI 요약 카드 (총 지출, 월평균 지출, 직전 동기간 대비 증감률)
 * - 모바일 카테고리 비중 요약 랭킹 (누적 금액 및 프로그레스 바)
 * - 터치 친화적 카드형 거래 내역 리스트 (통계 제외 뱃지, 소유주/결제수단 뱃지)
 * - 100건 단위 페이징 더보기 (Load More)
 */
export default function MobileExpensesPage() {
  const { formatCurrency } = useFormatters();

  // 필터 상태
  const [selectedOwner, setSelectedOwner] = useState('전체');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [activePreset, setActivePreset] = useState('1m');

  // 직접 지정 패널 상태
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // 데이터 상태
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [hasMore, setHasMore] = useState(false);

  // 로딩 및 인터랙션 상태
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // 최근 24개월 옵션 목록
  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let i = 0; i < 24; i++) {
      list.push(`${y}-${String(m).padStart(2, '0')}`);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return list;
  }, []);

  // 토스트 타이머 언마운트 시 클린업
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 통계 및 거래 내역 데이터 로드 (첫 페이지)
  const fetchData = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const statsParams = {};
        if (startMonth) statsParams.start_month = startMonth;
        if (endMonth) statsParams.end_month = endMonth;
        if (selectedOwner && selectedOwner !== '전체') statsParams.owner = selectedOwner;

        const expenseParams = {
          limit: PAGE_SIZE,
          offset: 0,
        };
        if (startMonth) expenseParams.start_month = startMonth;
        if (endMonth) expenseParams.end_month = endMonth;
        if (selectedOwner && selectedOwner !== '전체') expenseParams.owner = selectedOwner;

        const [statsData, expenseList] = await Promise.all([
          expenseService.getStats(statsParams),
          expenseService.getExpenses(expenseParams),
        ]);

        setStats(statsData);
        const items = expenseList || [];
        setExpenses(items);
        setHasMore(items.length >= PAGE_SIZE);
      } catch (err) {
        setError(err.message || '지출 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [startMonth, endMonth, selectedOwner]
  );

  // 필터 변경 시 데이터 자동 로드
  useEffect(() => {
    fetchData();
  }, [startMonth, endMonth, selectedOwner]);

  // 새로고침 핸들러
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage(null);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    try {
      await fetchData();
      setToastMessage({ type: 'success', text: '지출 데이터가 최신화되었습니다.' });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || '새로고침 실패' });
    } finally {
      setIsRefreshing(false);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // 소유주 탭 변경 핸들러
  const handleOwnerChange = (owner) => {
    if (selectedOwner === owner) return;
    setSelectedOwner(owner);
  };

  // 기간 프리셋 클릭 핸들러
  const handlePresetClick = (presetId) => {
    setActivePreset(presetId);
    setIsCustomOpen(false);

    const baseEnd = endMonth || stats?.end_month || monthOptions[0];
    let newStart = baseEnd;
    let newEnd = baseEnd;

    if (presetId === '1m') {
      newStart = baseEnd;
    } else if (presetId === '3m') {
      newStart = getPastMonth(baseEnd, 2);
    } else if (presetId === '6m') {
      newStart = getPastMonth(baseEnd, 5);
    } else if (presetId === '1y') {
      newStart = getPastMonth(baseEnd, 11);
    } else if (presetId === 'ytd') {
      const year = baseEnd.split('-')[0];
      newStart = `${year}-01`;
    }

    setStartMonth(newStart);
    setEndMonth(newEnd);
    setCustomStart(newStart);
    setCustomEnd(newEnd);
  };

  // 직접 지정 토글 칩 클릭 핸들러
  const handleCustomToggle = () => {
    const nextState = !isCustomOpen;
    setIsCustomOpen(nextState);
    if (nextState) {
      setCustomStart(startMonth || stats?.start_month || monthOptions[0]);
      setCustomEnd(endMonth || stats?.end_month || monthOptions[0]);
    }
  };

  // 직접 지정 조회 실행
  const handleCustomApply = () => {
    let finalStart = customStart;
    let finalEnd = customEnd;
    if (finalStart > finalEnd) {
      finalEnd = finalStart;
    }
    setStartMonth(finalStart);
    setEndMonth(finalEnd);
    setActivePreset('custom');
    setIsCustomOpen(false);
  };

  // 거래 내역 더보기 (Load More 100건)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const expenseParams = {
        limit: PAGE_SIZE,
        offset: expenses.length,
      };
      if (startMonth) expenseParams.start_month = startMonth;
      if (endMonth) expenseParams.end_month = endMonth;
      if (selectedOwner && selectedOwner !== '전체') expenseParams.owner = selectedOwner;

      const nextList = await expenseService.getExpenses(expenseParams);
      const nextItems = nextList || [];
      if (nextItems.length > 0) {
        setExpenses((prev) => [...prev, ...nextItems]);
        setHasMore(nextItems.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      alert(`거래 추가 로드 실패: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // 거래일시 날짜 포맷팅 (YYYY-MM-DD)
  const formatTxDate = (dtStr) => {
    if (!dtStr) return '-';
    return dtStr.slice(0, 10);
  };

  // 증감률 및 증감액 계산
  const changeRate = stats?.prev_period_change_rate ?? stats?.mom_change_rate;
  const changeAmount = stats?.prev_period_change_amount ?? stats?.mom_change_amount;

  return (
    <div className="space-y-4 max-w-md mx-auto relative pb-6">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          className={`sticky top-2 z-30 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all text-center animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-rose-500 text-white shadow-rose-500/20'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* 1. 상단 페이지 헤더 및 새로고침 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-400" />
            <span>지출 관리</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            월별 및 다기간 지출 내역과 소비 패턴을 분석합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="새로고침"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            isRefreshing
              ? 'bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border-slate-700/60 shadow-sm'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
          <span>{isRefreshing ? '갱신 중...' : '새로고침'}</span>
        </button>
      </div>

      {/* 2. 상단 소유주 탭 ('전체', '장준', '성은') */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
        {OWNER_OPTIONS.map((owner) => (
          <button
            key={owner}
            type="button"
            onClick={() => handleOwnerChange(owner)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              selectedOwner === owner
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {owner}
          </button>
        ))}
      </div>

      {/* 3. 가로 스크롤 기간 프리셋 칩 및 직접 지정 토글 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {PRESET_OPTIONS.map((preset) => {
            const isActive = activePreset === preset.id && !isCustomOpen;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleCustomToggle}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1 ${
              isCustomOpen || activePreset === 'custom'
                ? 'bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-600/20'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span>직접 지정 🗓</span>
            {isCustomOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 직접 지정 패널 (토글 시 노출) */}
        {isCustomOpen && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md space-y-2.5 animate-in fade-in duration-150">
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>조회 기간 직접 선택</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={customStart}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomStart(val);
                  if (customEnd && val > customEnd) {
                    setCustomEnd(val);
                  }
                }}
                aria-label="시작년월 선택"
                className="flex-1 py-1.5 px-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {monthOptions.map((ym) => (
                  <option key={`m-start-${ym}`} value={ym}>
                    {ym}
                  </option>
                ))}
              </select>

              <span className="text-slate-500 text-xs font-bold">~</span>

              <select
                value={customEnd}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomEnd(val);
                  if (customStart && val < customStart) {
                    setCustomStart(val);
                  }
                }}
                aria-label="종료년월 선택"
                className="flex-1 py-1.5 px-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {monthOptions.map((ym) => (
                  <option key={`m-end-${ym}`} value={ym}>
                    {ym}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCustomApply}
                className="py-1.5 px-3.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-sky-600/30"
              >
                조회
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 에러 상태 배너 */}
      {error && (
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 text-center">
          <AlertCircle className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
          <p className="text-xs text-rose-300 font-semibold mb-2">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <div className="space-y-4 animate-pulse py-1">
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-3xl" />
          <div className="h-36 bg-slate-900 border border-slate-800 rounded-3xl" />
          <div className="space-y-2">
            <div className="h-20 bg-slate-900 border border-slate-800 rounded-2xl" />
            <div className="h-20 bg-slate-900 border border-slate-800 rounded-2xl" />
            <div className="h-20 bg-slate-900 border border-slate-800 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* 4. 모바일 핵심 KPI 요약 카드 */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            {/* 상단 기간 배지 & 소유주 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">기간 총 지출</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px] font-mono font-semibold">
                {stats?.start_month === stats?.end_month
                  ? stats?.start_month || startMonth
                  : `${stats?.start_month || startMonth} ~ ${stats?.end_month || endMonth}`}
              </span>
            </div>

            {/* 총 지출 금액 */}
            <div>
              <div className="text-2xl font-black text-white tracking-tight font-mono">
                {formatCurrency(stats?.period_total ?? stats?.current_total ?? 0)}
              </div>
            </div>

            {/* 하단 2분할 지표: 월평균 지출 & 전기간 대비 증감률 */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3">
              {/* 월평균 지출 (신규 지표) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span>월평균 지출</span>
                  <span className="text-[10px] text-slate-500">
                    ({stats?.period_months || 1}개월)
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {formatCurrency(stats?.monthly_average ?? 0)}
                </div>
              </div>

              {/* 전기간 대비 증감률 */}
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">
                  {stats?.period_months > 1 ? '직전 동기간 대비' : '전월 대비 (MoM)'}
                </div>
                <div className="flex items-center gap-1">
                  {changeRate !== undefined && changeRate !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
                        changeRate > 0
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : changeRate < 0
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {changeRate > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : changeRate < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Minus className="w-3 h-3" />
                      )}
                      <span>
                        {changeRate > 0 ? `+${changeRate.toFixed(1)}%` : `${changeRate.toFixed(1)}%`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. 모바일 카테고리 비중 요약 (Progress Bar) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white tracking-tight">카테고리별 비중</h2>
              <span className="text-[10px] text-slate-400">선택 기간 누적</span>
            </div>

            {stats?.category_breakdown && stats.category_breakdown.length > 0 ? (
              <div className="space-y-2.5">
                {stats.category_breakdown.map((cat, idx) => (
                  <div key={cat.category_name || idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || '#38bdf8' }}
                        />
                        <span className="text-slate-300 font-medium truncate">
                          {cat.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono flex-shrink-0">
                        <span className="text-white font-bold">{formatCurrency(cat.amount)}</span>
                        <span className="text-slate-400 text-[11px] w-12 text-right">
                          {Number(cat.percentage || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* 프로그레스 바 */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                          backgroundColor: cat.color || '#38bdf8',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500">
                표시할 카테고리별 지출 내역이 없습니다.
              </div>
            )}
          </div>

          {/* 6. 카드형 거래 내역 리스트 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-white tracking-tight">
                거래 내역 ({expenses.length}건)
              </h2>
              {stats?.excluded_total > 0 && (
                <span className="text-[10px] text-slate-500">
                  제외 합계: {formatCurrency(stats.excluded_total)}
                </span>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">거래 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2 hover:border-slate-700 transition-colors"
                  >
                    {/* 상단: 일자 / 소유주 / 결제수단 / 카테고리 & 제외 뱃지 */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 font-medium">
                          {formatTxDate(tx.transaction_date)}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] font-bold text-slate-300 truncate">
                          {tx.owner} {tx.payment_method_name || tx.institution ? `(${tx.payment_method_name || tx.institution})` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-sky-500/20">
                          {tx.category_name || '미분류'}
                        </span>
                        {tx.is_excluded && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            통계 제외
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 중앙: 가맹점 / 거래 금액 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {tx.merchant || tx.description || '가맹점 미상'}
                        </div>
                        {tx.memo && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {tx.memo}
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-extrabold text-white font-mono">
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 7. 리스트 하단 '내역 더보기' 버튼 (100건 단위 페이징) */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-sky-400 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>추가 내역을 불러오는 중...</span>
                  </>
                ) : (
                  <span>내역 더보기 (100건 추가)</span>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
