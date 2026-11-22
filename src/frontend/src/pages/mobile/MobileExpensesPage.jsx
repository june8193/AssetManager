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
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast } from '../../components/mobile/MobileStatusFeedback';

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
 * 모바일 전용 지출 관리 페이지 컴포넌트 (`/m/expenses`, 클린 라이트 톤)
 *
 * - 상단 소유주 탭 ('전체', '장준', '성은')
 * - 가로 스크롤 기간 프리셋 필 ('당월', '3개월', '6개월', '1년', '올해', '직접 지정')
 * - 모바일 토글형 기간 직접 지정 (시작월, 종료월 드롭다운 및 조회) 패널
 * - 모바일 핵심 KPI 요약 카드 (총 지출, 월평균 지출, 직전 동기간 대비 증감률)
 * - 모바일 카테고리 비중 요약 랭킹 (누적 금액 및 슬림 바)
 * - 단일 흰색 카드 내 얇은 구분선 플랫 거래 내역 리스트 (100건 단위 더보기)
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
  const fetchData = useCallback(async () => {
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
  }, [startMonth, endMonth, selectedOwner]);

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

  useMobileHeaderRefresh(handleRefresh, isRefreshing);

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

  // 증감률 계산
  const changeRate = stats?.prev_period_change_rate ?? stats?.mom_change_rate;

  return (
    <div className="space-y-3 max-w-md mx-auto relative pb-6">
      <MobileToast toast={toastMessage} />

      {/* 1. 상단 소유주 세그먼트 탭 ('전체', '장준', '성은') */}
      <div className="flex p-1 bg-[#E5E8EB]/70 rounded-xl gap-1">
        {OWNER_OPTIONS.map((owner) => (
          <button
            key={owner}
            type="button"
            onClick={() => handleOwnerChange(owner)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs transition-all ${
              selectedOwner === owner
                ? 'bg-white text-[#191F28] font-semibold shadow-xs'
                : 'text-[#6B7684] hover:text-[#191F28] font-medium'
            }`}
          >
            {owner}
          </button>
        ))}
      </div>

      {/* 2. 가로 스크롤 기간 프리셋 칩 및 직접 지정 토글 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {PRESET_OPTIONS.map((preset) => {
            const isActive = activePreset === preset.id && !isCustomOpen;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[#191F28] text-white border-[#191F28]'
                    : 'bg-white text-[#4E5968] border-[#E5E8EB]/80 hover:border-[#CBD5E1]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleCustomToggle}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1 ${
              isCustomOpen || activePreset === 'custom'
                ? 'bg-[#191F28] text-white border-[#191F28]'
                : 'bg-white text-[#4E5968] border-[#E5E8EB]/80 hover:border-[#CBD5E1]'
            }`}
          >
            <span>직접 지정</span>
            {isCustomOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 직접 지정 패널 (토글 시 노출) */}
        {isCustomOpen && (
          <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-[#6B7684] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3182F6]" />
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
                className="flex-1 py-2 px-2.5 bg-[#F2F4F6] border border-transparent rounded-xl text-xs font-semibold text-[#191F28] focus:outline-none focus:border-[#3182F6]"
              >
                {monthOptions.map((ym) => (
                  <option key={`m-start-${ym}`} value={ym}>
                    {ym}
                  </option>
                ))}
              </select>

              <span className="text-[#8B95A1] text-xs font-bold">~</span>

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
                className="flex-1 py-2 px-2.5 bg-[#F2F4F6] border border-transparent rounded-xl text-xs font-semibold text-[#191F28] focus:outline-none focus:border-[#3182F6]"
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
                className="py-2 px-3.5 bg-[#3182F6] hover:bg-[#1B64DA] active:scale-95 text-white rounded-xl text-xs font-semibold transition-all"
              >
                조회
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 에러 상태 배너 */}
      {error && (
        <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 text-center">
          <AlertCircle className="w-5 h-5 text-[#F04452] mx-auto mb-1.5" />
          <p className="text-xs text-[#F04452] font-semibold mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#3182F6] hover:bg-[#1B64DA] text-white rounded-xl text-xs font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <div className="space-y-3 animate-pulse py-1">
          <div className="h-40 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
          <div className="h-36 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
          <div className="h-44 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* 3. 모바일 핵심 KPI 요약 카드 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B95A1] font-medium">기간 총 지출</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#4E5968] text-[11px] font-semibold tabular-nums">
                {stats?.start_month === stats?.end_month
                  ? stats?.start_month || startMonth
                  : `${stats?.start_month || startMonth} ~ ${stats?.end_month || endMonth}`}
              </span>
            </div>

            <div className="text-[26px] font-bold text-[#191F28] tracking-tight tabular-nums leading-tight">
              {formatCurrency(stats?.period_total ?? stats?.current_total ?? 0)}
            </div>

            {/* 하단 2분할 지표: 월평균 지출 & 전기간 대비 증감률 */}
            <div className="pt-3.5 border-t border-[#F2F4F6] grid grid-cols-2 gap-3 tabular-nums">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-[#8B95A1] font-medium">
                  <span>월평균 지출</span>
                  <span>({stats?.period_months || 1}개월)</span>
                </div>
                <div className="text-sm font-bold text-[#191F28]">
                  {formatCurrency(stats?.monthly_average ?? 0)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[#8B95A1] font-medium">
                  {stats?.period_months > 1 ? '직전 동기간 대비' : '전월 대비 (MoM)'}
                </div>
                <div className="flex items-center gap-1">
                  {changeRate !== undefined && changeRate !== null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        changeRate > 0
                          ? 'bg-[#FFF0F1] text-[#F04452]'
                          : changeRate < 0
                          ? 'bg-[#E8F3FF] text-[#3182F6]'
                          : 'bg-[#F2F4F6] text-[#6B7684]'
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
                    <span className="text-xs text-[#8B95A1]">-</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 4. 모바일 카테고리 비중 요약 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#191F28] tracking-tight">카테고리별 비중</h2>
              <span className="text-[11px] text-[#8B95A1]">선택 기간 누적</span>
            </div>

            {stats?.category_breakdown && stats.category_breakdown.length > 0 ? (
              <div className="space-y-3">
                {stats.category_breakdown.map((cat, idx) => (
                  <div key={cat.category_name || idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || '#3182F6' }}
                        />
                        <span className="text-[#191F28] font-semibold truncate">
                          {cat.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums shrink-0">
                        <span className="text-[#191F28] font-bold">{formatCurrency(cat.amount)}</span>
                        <span className="text-[#8B95A1] text-[11px] w-11 text-right">
                          {Number(cat.percentage || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* 슬림 프로그레스 바 */}
                    <div className="w-full bg-[#F2F4F6] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                          backgroundColor: cat.color || '#3182F6',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-[#8B95A1]">
                표시할 카테고리별 지출 내역이 없습니다.
              </div>
            )}
          </section>

          {/* 5. 플랫 거래 내역 리스트 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold text-[#6B7684]">
                거래 내역 ({expenses.length}건)
              </h2>
              {stats?.excluded_total > 0 && (
                <span className="text-[11px] text-[#8B95A1] tabular-nums">
                  제외 합계 {formatCurrency(stats.excluded_total)}
                </span>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="py-12 px-4 text-center bg-white border border-[#E5E8EB]/60 rounded-2xl">
                <Receipt className="w-7 h-7 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-xs text-[#8B95A1] font-medium">거래 내역이 없습니다.</p>
              </div>
            ) : (
              <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl divide-y divide-[#F2F4F6]">
                {expenses.map((tx) => (
                  <div key={tx.id} className="p-4 space-y-1.5">
                    {/* 상단: 일자 / 소유주 / 결제수단 / 카테고리 & 제외 뱃지 */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[11px] text-[#8B95A1] font-medium tabular-nums">
                          {formatTxDate(tx.transaction_date)}
                        </span>
                        <span className="text-[#CBD5E1]">·</span>
                        <span className="text-[11px] font-medium text-[#6B7684] truncate">
                          {tx.owner}{' '}
                          {tx.payment_method_name || tx.institution
                            ? `(${tx.payment_method_name || tx.institution})`
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F2F4F6] text-[#4E5968]">
                          {tx.category_name || '미분류'}
                        </span>
                        {tx.is_excluded && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF0F1] text-[#F04452]">
                            통계 제외
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 중앙: 가맹점 / 거래 금액 */}
                    <div className="flex items-start justify-between gap-2 tabular-nums">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#191F28] truncate">
                          {tx.merchant || tx.description || '가맹점 미상'}
                        </div>
                        {tx.memo && (
                          <div className="text-[11px] text-[#8B95A1] mt-0.5 truncate">
                            {tx.memo}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-[#191F28]">
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* 6. 리스트 하단 '내역 더보기' 버튼 */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 px-4 bg-white hover:bg-[#F9FAFB] active:scale-[0.98] text-[#3182F6] border border-[#E5E8EB]/60 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3182F6]" />
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
