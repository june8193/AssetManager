import { useState } from 'react';
import { Wallet, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 계좌별 자산 잔고 아코디언 카드 컴포넌트 (Read-Only)
 * - 계좌명, 금융기관, 별칭, 총 평가금액, 예수금 요약 표시
 * - 터치하여 아코디언 펼침/접힘으로 보유 종목 리스트 조회
 * - 수정/삭제/추가(CUD) 버튼이 없는 순수 읽기 전용 UI
 *
 * @param {Object} props
 * @param {Object} props.account - 계좌 및 보유 자산 정보
 */
export default function MobileAccountCard({ account }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { maskValue } = useMasking();

  if (!account) return null;

  const {
    name = '',
    provider = '',
    alias = '',
    total_valuation_krw = 0,
    assets = [],
  } = account;

  // 예수금(현금 자산) 잔고 합산 계산
  const cashBalance = assets
    .filter((a) => a.category === 'CASH' || a.ticker === 'KRW' || a.ticker === 'USD')
    .reduce((sum, a) => sum + (a.valuation_krw || 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md transition-all">
      {/* 계좌 요약 헤더 (터치 시 펼침/접힘) */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={`${provider} ${name} 계좌 상세`}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 active:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                {provider}
              </span>
              <span className="text-xs font-bold text-white truncate">{maskValue(name)}</span>
            </div>
            {alias && <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{alias}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm font-extrabold text-white">
              {maskValue(Math.round(total_valuation_krw).toLocaleString())}
              <span className="text-[10px] text-slate-400 ml-0.5">원</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-1 mt-0.5">
              <Coins className="w-2.5 h-2.5 text-amber-400" />
              <span>예수금:</span>
              <span className="text-slate-300 font-semibold">
                {maskValue(Math.round(cashBalance).toLocaleString())}원
              </span>
            </div>
          </div>
          <div className="text-slate-400">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-sky-400" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* 아코디언 펼침 내용: 보유 종목 리스트 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/40">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
              <span>보유 종목 ({assets.length}개)</span>
              <span>평가금액 (KRW)</span>
            </div>

            {assets.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 font-medium bg-slate-900/50 rounded-xl border border-slate-800/60">
                보유 종목이 없습니다.
              </div>
            ) : (
              assets.map((asset, idx) => {
                const isUsd = asset.country === 'US' || asset.ticker === 'USD';
                return (
                  <div
                    key={`${asset.id || asset.ticker}-${idx}`}
                    className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate">{asset.name}</span>
                        {asset.country && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              asset.country === 'KR'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {asset.country}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                        <span className="font-mono text-slate-400">{asset.ticker}</span>
                        <span>•</span>
                        <span>{asset.category || '기타'}</span>
                        <span>•</span>
                        <span>{maskValue(asset.quantity?.toLocaleString())}주</span>
                        <span>@ {asset.price?.toLocaleString()} {isUsd ? 'USD' : 'KRW'}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-extrabold text-white font-mono">
                        {maskValue(Math.round(asset.valuation_krw || 0).toLocaleString())}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">원</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
