import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Filter } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 자산 추이 시각화를 위한 라인 차트 컴포넌트입니다.
 * 
 * @param {Object} props
 * @param {Object} props.data - 시계열 자산 데이터
 * @param {Array} props.data.history - 일자별 자산 합계 및 계좌별 데이터 리스트
 * @param {Array} props.data.accounts - 계좌 정보 리스트 (필터링용)
 */
const AssetChart = ({ data }) => {
  const [filter, setFilter] = useState('total'); // 'total' or account_id string 'acc_1'
  const { maskValue } = useMasking();

  const { history, accounts } = data || {};

  const chartData = useMemo(() => {
    if (!history) return [];
    return history.map(item => ({
      ...item,
      timestamp: new Date(item.date).getTime(),
      displayValue: filter === 'total' ? (item.total || 0) : (item[filter] || 0)
    }));
  }, [history, filter]);

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '0';
    
    // 마스킹 적용
    const masked = maskValue(null);
    if (masked === '***') return '***';

    if (val >= 100000000) return `${(val / 100000000).toFixed(1)} 억`;
    if (val >= 10000) return `${(val / 10000).toFixed(0)} 만`;
    return val.toLocaleString();
  };

  const currentFilterName = filter === 'total' ? '총 자산' : 
    (accounts?.find(a => `acc_${a.id}` === filter)?.name || '계좌');

  if (!history || history.length === 0) {
    return (
      <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm mb-10 text-center">
        <TrendingUp className="mx-auto text-slate-200 mb-4" size={48} />
        <p className="text-slate-400 font-medium">표시할 자산 추이 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={28} />
            자산 추이
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">시간에 따른 자산 평가액 변화 ({currentFilterName})</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-50 border-none text-slate-700 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="total">총 자산 합계</option>
            {accounts?.map(acc => (
              <option key={acc.id} value={`acc_${acc.id}`}>{acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timestamp" 
              type="number"
              domain={['dataMin', 'dataMax']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              dy={10}
              tickFormatter={(ts) => {
                const date = new Date(ts);
                const year = date.getFullYear().toString().slice(-2);
                return `${year}/${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickFormatter={formatCurrency}
              width={60}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
              formatter={(value) => [maskValue(Math.round(value).toLocaleString()) + ' 원', currentFilterName]}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area 
              type="monotone" 
              dataKey="displayValue" 
              stroke="#2563eb" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorVal)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AssetChart;
