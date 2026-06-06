import React, { useMemo, useState } from 'react';
import { useBenchmark } from '../hooks/useBenchmark';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Wallet, Activity, RefreshCw, AlertCircle, Calendar, Plus, Check } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';
import YearlyComparisonTable from '../components/YearlyComparisonTable';
import DailyComparisonTable from '../components/DailyComparisonTable';

/**
 * 벤치마크 비교 대시보드 페이지 컴포넌트입니다.
 * 
 * 포트폴리오 수익률과 시장 주요 지수 및 관심 종목 성과를 정규화하여 
 * 일대일 비교 선 차트와 초과수익률 분석 테이블을 제공합니다.
 * 
 * Returns:
 *     JSX.Element: 벤치마크 대시보드 렌더링 결과
 */
const BenchmarkPage = () => {
  const {
    data,
    loading,
    error,
    period,
    setPeriod,
    refresh,
    toggleWatchlistStock,
    activeWatchlistDataset
  } = useBenchmark();

  const { maskValue } = useMasking();

  // 차트 렌더링 여부를 관리하는 통합 상태 (기본값 모두 True)
  const [activeSeries, setActiveSeries] = useState({
    "내 포트폴리오": true,
    "KOSPI": true,
    "KOSDAQ": true,
    "S&P 500": true,
    "NASDAQ": true,
  });

  const { portfolio, indices, alpha_analysis, watchlist } = data || {};

  // Recharts 형식에 맞게 데이터셋 가공
  const chartData = useMemo(() => {
    if (!data?.chart?.labels) return [];

    const { labels, datasets } = data.chart;
    
    return labels.map((label, idx) => {
      const row = { date: label };
      
      // 내 포트폴리오 및 기본 지수 데이터 매핑
      datasets.forEach(ds => {
        row[ds.label] = ds.data[idx] !== undefined ? ds.data[idx] : null;
      });

      // 토글된 관심 종목 데이터 매핑 (Lazy Loading)
      Object.keys(activeWatchlistDataset).forEach(stockCode => {
        const hist = activeWatchlistDataset[stockCode];
        if (hist && hist.labels) {
          const histIdx = hist.labels.indexOf(label);
          const dataKey = `watchlist_${hist.ticker}`;
          if (histIdx !== -1) {
            row[dataKey] = hist.data[histIdx];
          } else {
            // 날짜가 일치하지 않으면 직전 영업일 값을 찾아 채워넣음 (Forward Fill)
            let prevLabelIdx = -1;
            for (let i = hist.labels.length - 1; i >= 0; i--) {
              if (hist.labels[i] < label) {
                prevLabelIdx = i;
                break;
              }
            }
            if (prevLabelIdx !== -1) {
              row[dataKey] = hist.data[prevLabelIdx];
            } else {
              row[dataKey] = null;
            }
          }
        }
      });

      return row;
    });
  }, [data, activeWatchlistDataset]);

  // 최신 스냅샷 날짜 추출 (YYYY-MM-DD 포맷)
  const latestSnapshotDate = useMemo(() => {
    if (!data?.chart?.labels || data.chart.labels.length === 0) return '';
    return data.chart.labels[data.chart.labels.length - 1];
  }, [data]);

  // 관심종목의 고유 색상 매칭 함수
  const getWatchlistColor = useMemo(() => {
    return (stockCode) => {
      const idx = watchlist?.findIndex(w => w.stock_code === stockCode) || 0;
      const colors = ["#eab308", "#f43f5e", "#60a5fa", "#22c55e", "#ec4899"];
      return colors[idx % colors.length];
    };
  }, [watchlist]);

  // 관심종목 차트 라인들 동적 생성
  const watchlistLines = useMemo(() => {
    return Object.keys(activeWatchlistDataset).map((stockCode) => {
      const hist = activeWatchlistDataset[stockCode];
      if (!hist) return null;

      // 관심종목 목록(watchlist)에서 실제 종목이름 매칭
      const watchlistInfo = watchlist?.find(w => w.stock_code === stockCode);
      const displayName = watchlistInfo ? watchlistInfo.stock_name : hist.ticker;
      const color = getWatchlistColor(stockCode);

      return (
        <Line
          key={stockCode}
          type="monotone"
          dataKey={`watchlist_${hist.ticker}`}
          name={`관심: ${displayName}`}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 4"
          pointRadius={0}
          dot={false}
          animationDuration={800}
        />
      );
    });
  }, [activeWatchlistDataset, watchlist, getWatchlistColor]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium">성과 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-red-50 border border-red-100 p-8 rounded-3xl inline-flex flex-col items-center">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* 상단 타이틀 & 필터 선택 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={32} />
            시장분석 대시보드
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">시장 주요 지수 및 관심 종목과 성과를 분석합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="YTD">올해 누적 (YTD)</option>
            <option value="1M">최근 1개월</option>
            <option value="3M">최근 3개월</option>
            <option value="1Y">최근 1년</option>
          </select>

          <button
            onClick={refresh}
            className="flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 hover:shadow-sm transition-all"
            title="새로고침"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* 1. 성과 요약 카드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 내 포트폴리오 */}
        <div className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-bold text-slate-400">내 총자산</span>
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
              {period} {portfolio?.ytd_return >= 0 ? "+" : ""}{portfolio?.ytd_return}%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            ₩ {maskValue(Math.round(portfolio?.actual_latest_valuation ?? portfolio?.total_valuation ?? 0).toLocaleString())}
          </div>
          <div className="text-slate-400 text-[10px] mt-2 flex flex-col gap-0.5">
            <span className="flex items-center gap-1 font-medium">
              <Wallet size={11} className="text-blue-500" />
              최신 스냅샷 {portfolio?.actual_latest_date || latestSnapshotDate} 기준
            </span>
            {latestSnapshotDate && (
              <span className="text-slate-400/80 font-medium pl-[15px]">
                ※ 수익률 비교 기준일: {latestSnapshotDate}
              </span>
            )}
          </div>
        </div>

        {/* 4대 시장 지수 요약 카드 */}
        {Object.entries(indices || {}).map(([ticker, info]) => {
          const isUp = info.return >= 0;
          const isSuperior = info.alpha >= 0;
          
          return (
            <div key={ticker} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  {info.name}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    {ticker}
                  </span>
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}>
                  {period} {isUp ? "+" : ""}{info.return}%
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">
                {info.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-bold mt-2">
                지수 대비{" "}
                <span className={isSuperior ? "text-emerald-500" : "text-rose-500"}>
                  {isSuperior ? "+" : ""}{info.alpha}%p {isSuperior ? "상회" : "하회"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. 중앙 비교 추이 차트 */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">누적 수익률 비교 추이 (%)</h2>
            <p className="text-slate-400 text-xs font-medium mt-0.5">
              조회 기간의 첫 거래일을 0% 기준으로 정규화한 성과 그래프입니다. (하단 관심 종목 클릭 시 차트 실시간 비교 연동)
            </p>
          </div>
        </div>

        <div className="h-[400px] w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                dy={10}
                tickFormatter={(val) => {
                  const date = new Date(val);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                tickFormatter={(val) => `${val}%`}
                width={65}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '16px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px',
                  fontSize: '13px'
                }}
                formatter={(value, name) => [`${parseFloat(value).toFixed(2)}%`, name]}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              
              {/* 내 포트폴리오 라인 */}
              {activeSeries["내 포트폴리오"] && (
                <Line
                  type="monotone"
                  dataKey="내 포트폴리오"
                  stroke="#38bdf8"
                  strokeWidth={3.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                  animationDuration={1000}
                  connectNulls={true}
                />
              )}

              {/* 4대 지수 라인 */}
              {activeSeries["KOSPI"] && <Line type="monotone" dataKey="KOSPI" stroke="#fb7185" strokeWidth={1.5} dot={false} />}
              {activeSeries["KOSDAQ"] && <Line type="monotone" dataKey="KOSDAQ" stroke="#f472b6" strokeWidth={1.5} dot={false} />}
              {activeSeries["S&P 500"] && <Line type="monotone" dataKey="S&P 500" stroke="#34d399" strokeWidth={1.5} dot={false} />}
              {activeSeries["NASDAQ"] && <Line type="monotone" dataKey="NASDAQ" stroke="#a78bfa" strokeWidth={1.5} dot={false} />}

              {/* 관심 종목 라인들 (Lazy Loading) */}
              {watchlistLines}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 차트 하단 통합 ON/OFF 토글 컨트롤러 영역 */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-6 border-t border-slate-50 select-none">
          {/* 내 포트폴리오 토글 */}
          <button
            onClick={() => setActiveSeries(prev => ({ ...prev, "내 포트폴리오": !prev["내 포트폴리오"] }))}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeSeries["내 포트폴리오"]
                ? "bg-[#38bdf8] text-white shadow-sm shadow-[#38bdf8]/30 scale-105"
                : "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeSeries["내 포트폴리오"] ? "bg-white" : "bg-slate-300"}`}></div>
            내 포트폴리오
          </button>

          {/* 4대 시장 지수 토글 */}
          {[
            { key: "KOSPI", bg: "bg-[#fb7185]" },
            { key: "KOSDAQ", bg: "bg-[#f472b6]" },
            { key: "S&P 500", bg: "bg-[#34d399]" },
            { key: "NASDAQ", bg: "bg-[#a78bfa]" }
          ].map((item) => {
            const isActive = activeSeries[item.key];
            return (
              <button
                key={item.key}
                onClick={() => setActiveSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? `${item.bg} text-white shadow-sm shadow-black/10 scale-105`
                    : "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-slate-300"}`}></div>
                {item.key}
              </button>
            );
          })}

          {/* 관심 종목 토글 */}
          {watchlist?.map((item) => {
            const isChecked = !!activeWatchlistDataset[item.stock_code];
            const color = getWatchlistColor(item.stock_code);
            return (
              <button
                key={item.stock_code}
                onClick={() => toggleWatchlistStock(item.stock_code)}
                style={isChecked ? { backgroundColor: color, borderColor: color, color: '#fff' } : {}}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isChecked
                    ? "shadow-sm shadow-black/10 scale-105 border border-transparent"
                    : "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isChecked ? "bg-white" : "bg-slate-300"}`}></div>
                관심: {item.stock_name}
              </button>
            );
          })}
        </div>
      </div>


      {/* 3. 하단 상세 분석 & 관심 종목 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 좌측: 초과수익률 분석 테이블 */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
            <h3 className="text-lg font-bold text-slate-800">벤치마크 초과수익률 (Alpha) 분석</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 rounded-l-2xl">비교 벤치마크</th>
                  <th className="px-4 py-3.5 text-right">지수 {period}</th>
                  <th className="px-4 py-3.5 text-right">내 {period}</th>
                  <th className="px-4 py-3.5 text-right">초과수익률 (Alpha)</th>
                  <th className="px-4 py-3.5 text-center rounded-r-2xl">성과 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alpha_analysis?.map((item) => {
                  const isPlus = item.alpha >= 0;
                  return (
                    <tr key={item.ticker} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-700">vs {item.benchmark}</td>
                      <td className="px-4 py-4 text-right font-medium text-slate-500">{item.benchmark_return >= 0 ? "+" : ""}{item.benchmark_return}%</td>
                      <td className="px-4 py-4 text-right font-semibold text-blue-600">+{item.portfolio_return}%</td>
                      <td className={`px-4 py-4 text-right font-bold ${isPlus ? "text-emerald-500" : "text-rose-500"}`}>
                        {isPlus ? "+" : ""}{item.alpha}%p
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isPlus ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}>
                          {item.judgment}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!alpha_analysis || alpha_analysis.length === 0) && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400 font-medium">
                      성과 요약 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: 관심 종목 트래킹 섹션 */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Activity className="text-indigo-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800">관심 종목 트래킹 (Watchlist)</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 rounded-l-2xl">종목명 (티커)</th>
                    <th className="px-4 py-3.5 text-right">현재가</th>
                    <th className="px-4 py-3.5 text-right rounded-r-2xl">{period} 수익률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {watchlist?.map((item) => {
                    const isUp = item.period_return >= 0;
                    return (
                      <tr key={item.stock_code} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-800">{item.stock_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{item.stock_code}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {item.current_price?.toLocaleString()}{item.country === "US" ? "$" : "원"}
                        </td>
                        <td className={`px-4 py-3.5 text-right font-semibold rounded-r-2xl ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                          {isUp ? "+" : ""}{item.period_return}%
                        </td>
                      </tr>
                    );
                  })}
                  {(!watchlist || watchlist.length === 0) && (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-slate-400 font-medium">
                        등록된 관심 종목이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={() => window.location.href = '/watchlist'}
            className="mt-6 flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-2xl transition-all cursor-pointer"
          >
            <Plus size={16} />
            새 관심 종목 관리 페이지로 이동
          </button>
        </div>
      </div>

      {/* 연간 수익률 비교 표 */}
      <YearlyComparisonTable data={data?.yearly_comparison} />

      {/* 일간 수익률 비교 표 */}
      <DailyComparisonTable data={data?.daily_comparison} />
    </main>
  );
};

export default BenchmarkPage;
