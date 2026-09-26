import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  UploadCloud,
  CreditCard,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Building,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { expenseService } from '../services/expenseService';
import useFormatters from '../hooks/useFormatters';
import ExpenseUploadModal from '../components/ExpenseUploadModal';
import PaymentMethodsModal from '../components/PaymentMethodsModal';
import ExpenseCategoriesModal from '../components/ExpenseCategoriesModal';

const OWNER_OPTIONS = ['전체', '장준', '성은'];

/**
 * 지출 모니터링 대시보드 및 상세 거래 원장 관리 메인 페이지입니다.
 */
export default function ExpensesPage() {
  const { formatCurrency, isMasked } = useFormatters();

  // 대시보드 및 원장 데이터 상태
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // 필터 상태
  const [selectedOwner, setSelectedOwner] = useState('전체');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedExcludedFilter, setSelectedExcludedFilter] = useState('all'); // 'all' | 'included' | 'excluded'

  // 로딩 및 에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 모달 제어 상태
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // 최근 24개월 옵션 생성
  const monthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let i = 0; i < 24; i++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      list.push(ym);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return list;
  }, []);

  // 마스터 데이터(카테고리, 결제수단) 조회
  const fetchMasters = useCallback(async () => {
    try {
      const [catList, pmList] = await Promise.all([
        expenseService.getCategories(),
        expenseService.getPaymentMethods(),
      ]);
      setCategories(catList || []);
      setPaymentMethods(pmList || []);
    } catch (err) {
      console.error('마스터 정보 조회 실패:', err);
    }
  }, []);

  // 통계 및 거래 목록 조회
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsParams = {};
      if (selectedMonth) statsParams.year_month = selectedMonth;
      if (selectedOwner && selectedOwner !== '전체') statsParams.owner = selectedOwner;

      const statsData = await expenseService.getStats(statsParams);
      setStats(statsData);

      // 기준년월이 아직 선택되지 않았다면 stats에서 반환된 기준년월로 초기화
      if (!selectedMonth && statsData?.year_month) {
        setSelectedMonth(statsData.year_month);
      }

      // 거래 목록 필터 파라미터 구성
      const expenseParams = {};
      const activeMonth = selectedMonth || statsData?.year_month;
      if (activeMonth) expenseParams.year_month = activeMonth;
      if (selectedOwner && selectedOwner !== '전체') expenseParams.owner = selectedOwner;
      if (selectedCategory) expenseParams.category_id = selectedCategory;
      if (selectedInstitution) expenseParams.institution = selectedInstitution;
      if (selectedExcludedFilter === 'included') expenseParams.is_excluded = false;
      if (selectedExcludedFilter === 'excluded') expenseParams.is_excluded = true;
      if (searchKeyword.trim()) expenseParams.search = searchKeyword.trim();

      const expenseList = await expenseService.getExpenses(expenseParams);
      setExpenses(expenseList || []);
    } catch (err) {
      setError(err.message || '지출 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [
    selectedMonth,
    selectedOwner,
    selectedCategory,
    selectedInstitution,
    selectedExcludedFilter,
    searchKeyword,
  ]);

  // 최초 로드 시 마스터 및 데이터 조회
  useEffect(() => {
    fetchMasters();
  }, [fetchMasters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 인라인 카테고리 수정 핸들러
  const handleCategoryChange = async (expenseId, newCategoryId) => {
    try {
      const catId = newCategoryId ? Number(newCategoryId) : null;
      await expenseService.updateExpense(expenseId, { category_id: catId });

      // 로컬 상태 즉시 갱신
      const matchedCat = categories.find((c) => c.id === catId);
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expenseId
            ? { ...item, category_id: catId, category_name: matchedCat ? matchedCat.name : '미분류' }
            : item
        )
      );

      // 대시보드 통계 새로고침
      const statsParams = {};
      if (selectedMonth) statsParams.year_month = selectedMonth;
      if (selectedOwner && selectedOwner !== '전체') statsParams.owner = selectedOwner;
      const newStats = await expenseService.getStats(statsParams);
      setStats(newStats);
    } catch (err) {
      alert(`카테고리 변경 실패: ${err.message}`);
    }
  };

  // 인라인 통계 제외 여부 토글 핸들러
  const handleExcludedToggle = async (expenseId, currentExcluded) => {
    try {
      const nextExcluded = !currentExcluded;
      await expenseService.updateExpense(expenseId, { is_excluded: nextExcluded });

      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expenseId ? { ...item, is_excluded: nextExcluded } : item
        )
      );

      // 대시보드 통계 새로고침
      const statsParams = {};
      if (selectedMonth) statsParams.year_month = selectedMonth;
      if (selectedOwner && selectedOwner !== '전체') statsParams.owner = selectedOwner;
      const newStats = await expenseService.getStats(statsParams);
      setStats(newStats);
    } catch (err) {
      alert(`통계 제외 설정 실패: ${err.message}`);
    }
  };

  // 단일 거래 삭제 핸들러
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('해당 지출 내역을 삭제하시겠습니까?')) return;

    try {
      await expenseService.deleteExpense(expenseId);
      setExpenses((prev) => prev.filter((item) => item.id !== expenseId));

      // 통계 새로고침
      const statsParams = {};
      if (selectedMonth) statsParams.year_month = selectedMonth;
      if (selectedOwner && selectedOwner !== '전체') statsParams.owner = selectedOwner;
      const newStats = await expenseService.getStats(statsParams);
      setStats(newStats);
    } catch (err) {
      alert(`거래 삭제 실패: ${err.message}`);
    }
  };

  // 모달 작업 완료 시 콜백
  const handleUploadSuccess = () => {
    setIsUploadOpen(false);
    fetchData();
  };

  const handleMasterSuccess = () => {
    fetchMasters();
    fetchData();
  };

  // 고유 금융기관 목록 추출
  const institutionOptions = useMemo(() => {
    const set = new Set();
    paymentMethods.forEach((pm) => {
      if (pm.institution) set.add(pm.institution);
    });
    return Array.from(set);
  }, [paymentMethods]);

  // 날짜 포맷팅 헬퍼
  const formatDateTime = (dtStr) => {
    if (!dtStr) return '-';
    try {
      const dt = new Date(dtStr);
      if (isNaN(dt.getTime())) return dtStr;
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      return `${y}.${m}.${d} ${hh}:${mm}`;
    } catch {
      return dtStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. 상단 헤더: 타이틀, 소유주 탭, 모달 액션 버튼 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Receipt size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">지출 관리</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              월별 지출 추이 및 카드/통장 거래 원장 모니터링
            </p>
          </div>
        </div>

        {/* 우측 소유주 탭 & 액션 버튼 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 소유주 탭 버튼 그룹 */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {OWNER_OPTIONS.map((owner) => (
              <button
                key={owner}
                type="button"
                onClick={() => setSelectedOwner(owner)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedOwner === owner
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {owner}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* 액션 버튼 그룹 */}
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <UploadCloud size={16} />
            <span>명세서 업로드</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPaymentMethodsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <CreditCard size={16} />
            <span>결제수단 관리</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCategoriesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <Tag size={16} />
            <span>카테고리 관리</span>
          </button>
        </div>
      </div>

      {/* 에러 알림 배너 */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2.5 text-sm">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. 기준년월 선택 및 상단 KPI 카드 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">기준년월:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {ym}
                </option>
              ))}
            </select>
          </div>
          {stats && (
            <span className="text-xs text-slate-400">
              {selectedOwner === '전체' ? '가구 전체' : `${selectedOwner} 단독`} 집계 기준
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: 당월 총지출 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>당월 총지출</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-semibold">
                {stats?.year_month || selectedMonth}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {stats ? formatCurrency(stats.current_total) : '-'}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              전월 총액: {stats ? formatCurrency(stats.prev_total) : '-'}
            </div>
          </div>

          {/* KPI 2: 전월 대비 증감 (MoM) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>전월 대비 (MoM)</span>
              {stats && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                    stats.mom_change_rate > 0
                      ? 'bg-rose-50 text-rose-600'
                      : stats.mom_change_rate < 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stats.mom_change_rate > 0 ? (
                    <TrendingUp size={12} />
                  ) : stats.mom_change_rate < 0 ? (
                    <TrendingDown size={12} />
                  ) : (
                    <Minus size={12} />
                  )}
                  {stats.mom_change_rate > 0
                    ? `+${Number(stats.mom_change_rate).toFixed(1)}%`
                    : `${Number(stats.mom_change_rate).toFixed(1)}%`}
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {stats ? (
                  stats.mom_change_amount > 0 ? (
                    <span className="text-rose-600">+{formatCurrency(stats.mom_change_amount)}</span>
                  ) : stats.mom_change_amount < 0 ? (
                    <span className="text-emerald-600">{formatCurrency(stats.mom_change_amount)}</span>
                  ) : (
                    <span>0원</span>
                  )
                ) : (
                  '-'
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {stats?.mom_change_amount > 0 ? '전월 대비 지출 증가' : '전월 대비 지출 절약'}
            </div>
          </div>

          {/* KPI 3: 통계 제외 총액 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>통계 제외 총액</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px]">
                이중집계 방지
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-500 tracking-tight">
                {stats ? formatCurrency(stats.excluded_total) : '-'}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              카드대금·내부이체 등 합산 제외
            </div>
          </div>

          {/* KPI 4: 조회된 거래 건수 */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>기록된 거래 건수</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-semibold">
                원장 기록
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {expenses.length}
                <span className="text-base font-normal text-slate-500 ml-1">건</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              현재 필터 기준 유효 거래
            </div>
          </div>
        </div>
      </div>

      {/* 3. 시각화 차트 섹션: 최근 월별 추이 바차트 & 카테고리 비중 도넛차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 최근 12개월 지출 추이 바차트 (2컬럼 차지) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">월별 지출 추이 (최근 12개월)</h2>
            <span className="text-xs text-slate-400 font-mono">단위: 원</span>
          </div>

          <div className="h-64 w-full">
            {stats?.monthly_trends && stats.monthly_trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly_trends} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="year_month"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickFormatter={(val) => (isMasked ? '***' : `${Math.round(val / 10000)}만`)}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), '총지출']}
                    labelFormatter={(label) => `${label} 정산`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                  />
                  <Bar dataKey="total_amount" radius={[4, 4, 0, 0]}>
                    {stats.monthly_trends.map((entry, index) => {
                      const isCurrent = entry.year_month === (stats.year_month || selectedMonth);
                      return <Cell key={`bar-${index}`} fill={isCurrent ? '#2563EB' : '#94A3B8'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                표시할 지출 추이 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 당월 카테고리별 비중 도넛차트 (1컬럼 차지) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800">카테고리별 비중</h2>
            <span className="text-xs text-slate-400 font-mono">당월 기준</span>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {stats?.category_breakdown && stats.category_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.category_breakdown}
                    dataKey="amount"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {stats.category_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${formatCurrency(val)} (${item.payload.percentage}%)`,
                      name,
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-sm text-center py-6">
                카테고리별 지출 내역이 없습니다.
              </div>
            )}
          </div>

          {/* 카테고리 범례 리스트 */}
          <div className="mt-3 max-h-36 overflow-y-auto space-y-1.5 pr-1 border-t border-slate-100 pt-2 text-xs">
            {stats?.category_breakdown?.map((cat) => (
              <div key={cat.category_name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#94A3B8' }}
                  />
                  <span className="text-slate-700 truncate">{cat.category_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 font-medium">
                  <span className="text-slate-900">{formatCurrency(cat.amount)}</span>
                  <span className="text-slate-400 font-mono text-[11px] w-10 text-right">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 결제수단별 지출 요약 그리드 */}
      {stats?.payment_method_breakdown && stats.payment_method_breakdown.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">결제수단별 지출 요약</h2>
            <span className="text-xs text-slate-400">당월 유효 지출 기준</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stats.payment_method_breakdown.map((pm, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-800 truncate max-w-[140px]">
                        {pm.alias || `${pm.owner} ${pm.institution}`}
                      </div>
                      <div className="text-[11px] text-slate-400">{pm.institution}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      pm.owner === '장준'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-purple-50 text-purple-600'
                    }`}
                  >
                    {pm.owner}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-slate-900">
                      {formatCurrency(pm.amount)}
                    </span>
                    <span className="text-xs font-semibold text-blue-600 font-mono">
                      {pm.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(pm.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. 상세 거래 원장 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
        {/* 필터 툴바 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">거래 내역 원장</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
              총 {expenses.length}건
            </span>
          </div>

          {/* 검색 및 필터 컨트롤 그룹 */}
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            {/* 검색창 */}
            <div className="relative min-w-[200px]">
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="가맹점명 또는 메모..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* 카테고리 필터 */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
            >
              <option value="">카테고리 전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* 금융기관 필터 */}
            {institutionOptions.length > 0 && (
              <select
                value={selectedInstitution}
                onChange={(e) => setSelectedInstitution(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
              >
                <option value="">기관 전체</option>
                {institutionOptions.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            )}

            {/* 제외 항목 필터 */}
            <select
              value={selectedExcludedFilter}
              onChange={(e) => setSelectedExcludedFilter(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
            >
              <option value="all">제외항목: 전체</option>
              <option value="included">유효 지출만</option>
              <option value="excluded">통계 제외건만</option>
            </select>

            {/* 필터 초기화 버튼 */}
            {(searchKeyword || selectedCategory || selectedInstitution || selectedExcludedFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedCategory('');
                  setSelectedInstitution('');
                  setSelectedExcludedFilter('all');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="필터 초기화"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 테이블 영역 */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">거래일시</th>
                <th className="py-3 px-4">가맹점 / 내용</th>
                <th className="py-3 px-4">결제수단</th>
                <th className="py-3 px-4">소유주</th>
                <th className="py-3 px-4 text-right">금액</th>
                <th className="py-3 px-4">카테고리 (수정)</th>
                <th className="py-3 px-4 text-center">통계 제외</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">해당 조건에 일치하는 지출 내역이 없습니다.</p>
                  </td>
                </tr>
              ) : (
                expenses.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      tx.is_excluded ? 'bg-slate-50/50 text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {/* 거래일시 */}
                    <td className="py-3 px-4 text-xs font-mono whitespace-nowrap">
                      {formatDateTime(tx.transaction_date)}
                    </td>

                    {/* 가맹점 / 메모 */}
                    <td className="py-3 px-4 max-w-xs truncate">
                      <div className="font-medium text-slate-800 truncate">{tx.merchant}</div>
                      {tx.memo && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{tx.memo}</div>
                      )}
                    </td>

                    {/* 결제수단 */}
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span className="font-medium text-slate-700">
                        {tx.payment_method_alias || tx.institution}
                      </span>
                    </td>

                    {/* 소유주 */}
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          tx.owner === '장준'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        {tx.owner}
                      </span>
                    </td>

                    {/* 금액 */}
                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      <span className={tx.is_excluded ? 'line-through text-slate-400 font-normal' : ''}>
                        {formatCurrency(tx.amount)}
                      </span>
                    </td>

                    {/* 카테고리 (인라인 셀렉트) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        value={tx.category_id || ''}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">미분류</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 통계 제외 체크박스 */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={Boolean(tx.is_excluded)}
                        onChange={() => handleExcludedToggle(tx.id, tx.is_excluded)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={tx.is_excluded ? '통계에 다시 포함' : '통계에서 제외'}
                      />
                    </td>

                    {/* 관리: 삭제 버튼 */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(tx.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. 모달 컴포넌트 렌더링 */}
      <ExpenseUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        paymentMethods={paymentMethods}
        categories={categories}
      />

      <PaymentMethodsModal
        isOpen={isPaymentMethodsOpen}
        onClose={() => setIsPaymentMethodsOpen(false)}
        onSuccess={handleMasterSuccess}
      />

      <ExpenseCategoriesModal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        onSuccess={handleMasterSuccess}
      />
    </div>
  );
}
