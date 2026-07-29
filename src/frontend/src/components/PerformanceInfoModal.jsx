import React from 'react';
import { X, Info, ShieldAlert, Award, Calculator, TrendingDown, CheckCircle2 } from 'lucide-react';

/**
 * AssetManager 위험조정지표 계산 방식 및 지표 가이드 모달
 */
export default function PerformanceInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">AssetManager 위험조정 성과 산출 공식 & 산출 안내</h2>
              <p className="text-xs text-slate-500">포트폴리오 시간가중수익률(TWR) 및 무위험 수익률 기반 연산 가이드</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm leading-relaxed">
          
          {/* 1. 무위험 수익률 및 TWR 일별 보간 원리 */}
          <section className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-base">
              <Info size={18} className="text-blue-600" />
              <span>1. 무위험 수익률($R_f$) 및 TWR 불규칙 보간 수식</span>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 text-xs sm:text-sm">
              <li>
                <strong>일별 무위험 수익률 R_(f, daily)</strong>: 사용자가 직접 설정한 연율 무위험 수익률 R_(f, annual)(예: 3.5%)을 252 영업일로 단순 산술 분할합니다.
                <div className="font-mono bg-white p-2 rounded-md border border-slate-200 my-1 text-slate-800">
                  R_(f, daily) = R_(f, annual) / 252
                </div>
              </li>
              <li>
                <strong>입출금 배제 구간 수익률 (r_k)</strong>: 추가 입금/출금 등 외부 현금 흐름(CF_k)으로 인한 변동 착시를 TWR로 완전 배제합니다.
                <div className="font-mono bg-white p-2 rounded-md border border-slate-200 my-1 text-slate-800">
                  r_k = (V_k - CF_k - V_(k-1)) / V_(k-1)
                </div>
              </li>
              <li>
                <strong>불규칙 스냅샷 간격 일별 기하 보간 r_(daily, k)</strong>: 스냅샷 기록 간 실제 경과 일수(Δt_k)를 기반으로 정교한 일별 기하 수익률을 연산합니다.
                <div className="font-mono bg-white p-2 rounded-md border border-slate-200 my-1 text-slate-800">
                  r_(daily, k) = (1 + r_k)^(1 / Δt_k) - 1
                </div>
              </li>
            </ul>
          </section>

          {/* 2. 위험조정 지표 산출 수식 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Award size={18} className="text-indigo-600" />
              <span>2. 지표별 상세 계산 공식</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 샤프 지수 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>샤프 지수 (Sharpe Ratio)</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">총 변동성 대비</span>
                </div>
                <p className="text-xs text-slate-500">
                  포트폴리오의 전체 위험(변동성) 1단위당 창출한 초과 수익률을 나타냅니다.
                </p>
                <div className="font-mono bg-white p-2 rounded border border-slate-200 text-xs text-indigo-900 font-semibold">
                  Sharpe = (μ_annual - R_(f, annual)) / σ_annual
                </div>
                <p className="text-[11px] text-slate-400">
                  * σ_annual = σ_daily × √252 (252 영업일 연율화)
                </p>
              </div>

              {/* 소티노 지수 */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>소티노 지수 (Sortino Ratio)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">하방 변동성 대비</span>
                </div>
                <p className="text-xs text-slate-500">
                  상승 변동성은 배제하고, 손실 위험(무위험 수익률 미달 구간)만을 위험으로 측정합니다.
                </p>
                <div className="font-mono bg-white p-2 rounded border border-slate-200 text-xs text-emerald-900 font-semibold">
                  Sortino = (μ_annual - R_(f, annual)) / σ_(down, annual)
                </div>
                <p className="text-[11px] text-slate-400">
                  * σ_(down, daily) = √( (1/N) ∑ min(0, r_t - R_(f, daily))^2 )
                </p>
              </div>
            </div>
          </section>

          {/* 3. MDD (최대 낙폭) 연산 */}
          <section className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-2">
            <h3 className="text-base font-semibold text-amber-900 flex items-center gap-2">
              <TrendingDown size={18} className="text-amber-600" />
              <span>3. 최대 낙폭 (MDD, Maximum Drawdown) 연산</span>
            </h3>
            <p className="text-xs text-slate-600">
              특정 기간 내 고점(Peak) 대비 자산 평가액이 하락한 최악의 하락 폭(%)을 산출합니다.
            </p>
            <div className="font-mono bg-white p-2.5 rounded border border-amber-200 text-xs text-amber-950 font-medium">
              Drawdown_t (%) = (I_t - Peak_t) / Peak_t × 100
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>• <strong>최근 MDD</strong>: 조회 선택 기간의 마지막 날짜 기준 고점 대비 하락률 (DD_N)</p>
              <p>• <strong>기간 최고 MDD (Max MDD)</strong>: 선택 기간 내 발생했던 가장 깊은 낙폭 백분율 (Min DD_t)</p>
            </div>
          </section>

          {/* 4. 지표 해석 가이드 표 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-blue-600" />
              <span>4. 지표 해석 가이드 기준</span>
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">지표</th>
                    <th className="p-2.5">수치 범위</th>
                    <th className="p-2.5">해석 및 투자 의미</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-800" rowSpan={3}>샤프 / 소티노 지수</td>
                    <td className="p-2.5 font-mono text-emerald-600 font-bold">&gt; 1.0</td>
                    <td className="p-2.5">우수한 위험 대비 성과 (감수한 위험 대비 충분한 초과 수익 창출)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-amber-600 font-bold">0.5 ~ 1.0</td>
                    <td className="p-2.5">양호한 수준의 위험 대비 성과</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-rose-600 font-bold">&lt; 0.0</td>
                    <td className="p-2.5">무위험 수익률(예: 예금 금리)보다 낮은 저성과 상태</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-800" rowSpan={2}>MDD (최대 낙폭)</td>
                    <td className="p-2.5 font-mono text-emerald-600 font-bold">0% ~ -10%</td>
                    <td className="p-2.5">안정적인 리스크 관리 (하락장 방어력 우수)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-rose-600 font-bold">&lt; -20%</td>
                    <td className="p-2.5">높은 손실 위험 노출 (변동성 관리 및 리밸런싱 필요)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            확인 및 닫기
          </button>
        </div>

      </div>
    </div>
  );
}
