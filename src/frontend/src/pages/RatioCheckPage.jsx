import React, { useState, useMemo } from 'react';
import { useRatios } from '../hooks/useRatios';
import { useMasking } from '../contexts/MaskingContext';
import { PieChart as ReChartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, ChevronRight, Home, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';

// 대분류 기본 테마 색상 정의
const MAJOR_COLORS = {
  '주식': { main: '#6366f1', hover: '#4f46e5', light: '#818cf8', sub: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'] },
  '배당주': { main: '#ec4899', hover: '#db2777', light: '#f472b6', sub: ['#be185d', '#d946ef', '#f472b6', '#fbcfe8', '#fdf2f8'] },
  '현금': { main: '#14b8a6', hover: '#0d9488', light: '#2dd4bf', sub: ['#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4', '#ccfbf1'] },
  '채권': { main: '#f59e0b', hover: '#d97706', light: '#fbbf24', sub: ['#b45309', '#f59e0b', '#fbbf24', '#fde68a', '#fef3c7'] },
};

const DEFAULT_COLOR = { main: '#64748b', hover: '#475569', light: '#94a3b8', sub: ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'] };

/**
 * 파이차트의 각 조각 바깥으로 지시선과 텍스트 라벨을 그립니다.
 */
export const renderCustomizedLabel = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, outerRadius, fill, percent, name } = props;

  // 비중이 너무 작은 항목(1% 미만)은 텍스트 중첩 방지를 위해 제외
  if (percent < 0.01) return null;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  // 지시선 시작점 (외경보다 약간 밖으로)
  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;

  // 지시선 꺾임점
  const mx = cx + (outerRadius + 24) * cos;
  const my = cy + (outerRadius + 24) * sin;

  // 수평 지시선 끝점 (cos 방향에 맞춰 좌/우 이동)
  const ex = mx + (cos >= 0 ? 1 : -1) * 12;
  const ey = my;

  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      {/* 꺾인 지시선 그리기 */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      
      {/* 항목 이름 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 6}
        y={ey - 4}
        textAnchor={textAnchor}
        fill="#334155"
        fontSize="10px"
        fontWeight="700"
      >
        {name}
      </text>

      {/* 비중 백분율 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 6}
        y={ey + 8}
        textAnchor={textAnchor}
        fill="#64748b"
        fontSize="9px"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

/**
 * 대분류 기준 컬러를 반환합니다.
 */
const getMajorColor = (categoryName) => {
  return MAJOR_COLORS[categoryName] || DEFAULT_COLOR;
};

/**
 * 중분류/소분류 기준 컬러를 반환합니다.
 * 대분류 색상을 기준으로 투명도 또는 하위 컬러칩을 활용해 조화롭게 렌더링합니다.
 */
const getSubColor = (majorName, index) => {
  const theme = MAJOR_COLORS[majorName] || DEFAULT_COLOR;
  return theme.sub[index % theme.sub.length];
};

/**
 * 비중 점검 컴포넌트
 */
const RatioCheckPage = () => {
  const { hierarchy, loading, error, refreshHierarchy } = useRatios();
  const { isMasked, maskValue } = useMasking();

  // 드릴다운 레벨 상태 관리 ('root' | 'major' | 'sub')
  const [level, setLevel] = useState('root');
  const [selectedMajorName, setSelectedMajorName] = useState(null);
  const [selectedSubName, setSelectedSubName] = useState(null);

  // 금액 포맷 유틸
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
    return maskValue(formatted);
  };

  // 비율 포맷 유틸
  const formatPercent = (value) => {
    return (value || 0).toFixed(1) + '%';
  };

  // 최상위 총 자산 합계액 계산
  const rootTotal = useMemo(() => {
    if (!hierarchy) return 0;
    return hierarchy.reduce((sum, item) => sum + (item.current_value || 0), 0);
  }, [hierarchy]);

  // 현재 레벨에 따른 가공 데이터 산출
  const { currentValuation, titleName, titleLabel, chartData, listData } = useMemo(() => {
    const defaultRes = {
      currentValuation: 0,
      titleName: '전체 자산',
      titleLabel: '포트폴리오 루트',
      chartData: [],
      listData: []
    };

    if (!hierarchy || hierarchy.length === 0) return defaultRes;

    if (level === 'root') {
      const data = hierarchy.map((item) => {
        const theme = getMajorColor(item.category_name);
        return {
          name: item.category_name,
          value: item.current_value || 0,
          ratio: rootTotal > 0 ? ((item.current_value || 0) / rootTotal * 100) : 0,
          color: theme.main,
          hoverColor: theme.hover,
          raw: item
        };
      });

      return {
        currentValuation: rootTotal,
        titleName: '전체 자산',
        titleLabel: '포트폴리오 루트',
        chartData: data,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    if (level === 'major') {
      const majorNode = hierarchy.find(item => item.category_name === selectedMajorName);
      if (!majorNode) return defaultRes;

      const majorTotal = majorNode.current_value || 0;
      const data = (majorNode.children || []).map((item, idx) => {
        const color = getSubColor(selectedMajorName, idx);
        return {
          name: item.category_name,
          value: item.current_value || 0,
          ratio: majorTotal > 0 ? ((item.current_value || 0) / majorTotal * 100) : 0,
          color: color,
          hoverColor: color,
          raw: item
        };
      });

      return {
        currentValuation: majorTotal,
        titleName: majorNode.category_name,
        titleLabel: '선택된 대분류',
        chartData: data,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    if (level === 'sub') {
      const majorNode = hierarchy.find(item => item.category_name === selectedMajorName);
      if (!majorNode) return defaultRes;

      const subNode = (majorNode.children || []).find(item => item.category_name === selectedSubName);
      if (!subNode) return defaultRes;

      const subTotal = subNode.current_value || 0;
      const data = (subNode.children || []).map((item, idx) => {
        const color = getSubColor(selectedMajorName, idx + 2); // 톤을 약간 틀어줌
        return {
          name: item.name,
          ticker: item.ticker,
          value: item.valuation_krw || 0,
          ratio: subTotal > 0 ? ((item.valuation_krw || 0) / subTotal * 100) : 0,
          color: color,
          hoverColor: color,
          raw: item
        };
      });

      return {
        currentValuation: subTotal,
        titleName: subNode.category_name,
        titleLabel: `대분류: ${majorNode.category_name}`,
        chartData: data,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    return defaultRes;
  }, [hierarchy, level, selectedMajorName, selectedSubName, rootTotal]);

  // 네비게이션 줌 제어
  const zoomTo = (targetLevel, majorName = null, subName = null) => {
    if (targetLevel === 'root') {
      setLevel('root');
      setSelectedMajorName(null);
      setSelectedSubName(null);
    } else if (targetLevel === 'major') {
      setLevel('major');
      setSelectedMajorName(majorName);
      setSelectedSubName(null);
    } else if (targetLevel === 'sub') {
      setLevel('sub');
      setSelectedMajorName(majorName);
      setSelectedSubName(subName);
    }
  };

  // 초기화 핸들러
  const handleReset = () => {
    zoomTo('root');
  };

  // Recharts Pie 클릭 핸들러
  const handlePieClick = (dataEntry) => {
    if (level === 'root') {
      zoomTo('major', dataEntry.name);
    } else if (level === 'major') {
      zoomTo('sub', selectedMajorName, dataEntry.name);
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="font-medium">자산 비중 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  // 에러 화면
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-red-500 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold mb-2">데이터 로드 실패</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">{error}</p>
        <button
          onClick={refreshHierarchy}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* 타이틀 및 네비게이션 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 font-headline">
            <PieChart className="w-6 h-6 text-indigo-600" />
            자산 비중 점검
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            포트폴리오의 비중을 대분류, 중분류, 종목 계층별로 입체적으로 분석합니다.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="self-start sm:self-center px-4 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl border border-indigo-100 transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          전체 보기 (초기화)
        </button>
      </div>

      {/* 메인 레이아웃 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 왼쪽: 차트 패널 */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col gap-6">
          {/* Breadcrumb 내비게이션 */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 overflow-x-auto py-1">
            <button
              onClick={() => zoomTo('root')}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 text-slate-400"
            >
              <Home className="w-3.5 h-3.5" />
              포트폴리오
            </button>

            {selectedMajorName && (
              <div className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <button
                  data-testid="breadcrumb-major"
                  onClick={() => zoomTo('major', selectedMajorName)}
                  className={`hover:text-indigo-600 transition-colors font-semibold ${
                    level === 'major' ? 'text-slate-700 font-bold' : 'text-slate-400'
                  }`}
                >
                  {selectedMajorName}
                </button>
              </div>
            )}

            {selectedSubName && (
              <div className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-semibold text-slate-700 font-bold">
                  {selectedSubName}
                </span>
              </div>
            )}
          </div>

          {/* Recharts 파이차트 영역 */}
          <div className="relative flex-1 flex items-center justify-center min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <ReChartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={handlePieClick}
                    cursor="pointer"
                    animationDuration={600}
                    label={renderCustomizedLabel}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        style={{ outline: 'none' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs flex flex-col gap-1">
                            <div className="font-bold flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></span>
                              {data.name} {data.ticker ? `(${data.ticker})` : ''}
                            </div>
                            <div>평가액: {formatCurrency(data.value)}</div>
                            <div>비중: {formatPercent(data.ratio)}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </ReChartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <PieChart className="w-12 h-12 mb-3 opacity-10 text-slate-400" />
                <p className="text-sm">자산 데이터가 존재하지 않습니다.</p>
              </div>
            )}

            {/* 도넛 차트 내부 텍스트 뱃지 */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {level === 'root' ? '총 자산' : titleName}
              </span>
              <span className="text-lg md:text-xl font-black text-slate-800 font-headline mt-1">
                {formatCurrency(currentValuation)}
              </span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 bg-slate-50/50 py-2.5 rounded-xl border border-slate-100">
            💡 차트 조각을 클릭하면 하위 카테고리 비중으로 깊게 탐색할 수 있습니다.
          </div>
        </div>

        {/* 오른쪽: 상세 목록 패널 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 요약 메인 카드 */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl text-white p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -bottom-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl"></div>
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                {titleLabel}
              </span>
              <h2 className="text-xl font-extrabold font-headline">{titleName}</h2>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">평가 금액 합계</span>
                <span className="text-xl font-black font-headline text-emerald-400">
                  {formatCurrency(currentValuation)}
                </span>
              </div>
            </div>
          </div>

          {/* 구성 리스트 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">{titleName} 구성 비중</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {listData.length}개 항목
              </span>
            </div>

            <div className="divide-y divide-slate-50 max-h-[350px] overflow-y-auto pr-1">
              {listData.map((item, idx) => (
                <div
                  key={idx}
                  data-testid="ratio-row"
                  role={level !== 'sub' ? 'button' : undefined}
                  onClick={() => handlePieClick(item)}
                  className={`flex items-center justify-between py-3 group hover:bg-slate-50/50 transition-colors px-2 rounded-xl ${
                    level !== 'sub' ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                        {item.name} {item.ticker ? `(${item.ticker})` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {formatCurrency(item.value)}
                      </span>
                      {level === 'sub' && item.raw && item.raw.accounts && item.raw.accounts.length > 0 && (
                        <div className="mt-1.5 pl-2 border-l-2 border-slate-100 flex flex-col gap-1">
                          {item.raw.accounts.map((acc, accIdx) => {
                            const accountLabel = acc.alias ? `${acc.account_name}(${acc.alias})` : acc.account_name;
                            return (
                              <span key={accIdx} className="text-[9px] text-slate-400 font-medium leading-normal">
                                {acc.provider}, {accountLabel}: {formatCurrency(acc.valuation_krw)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold font-headline text-slate-800">
                      {formatPercent(item.ratio)}
                    </span>
                    {level !== 'sub' && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </div>
              ))}
              {listData.length === 0 && (
                <div className="py-10 text-center text-slate-400 text-xs">
                  항목이 존재하지 않습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatioCheckPage;
