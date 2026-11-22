import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 계좌별 자산 잔고 아코디언 카드 컴포넌트 (Read-Only, 클린 라이트 톤)
 * - 계좌명, 금융기관, 별칭, 총 평가금액, 예수금 요약 표시
 * - 터치하여 아코디언 펼침/접힘으로 보유 종목 플랫 리스트 조회 (평가금액 내림차순 정렬)
 *
 * @param {Object} props
 * @param {Object} props.account - 계좌 및 보유 자산 정보
 */
export default function MobileAccountCard({ account }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { maskValue } = useMasking();

  const {
    name = '',
    provider = '',
    alias = '',
    total_valuation_krw = 0,
    assets = [],
  } = account || {};

  // 보유 종목 정렬 (1차: valuation_krw 내림차순, 2차: name 오름차순)
  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const valA = Number(a?.valuation_krw) || 0;
      const valB = Number(b?.valuation_krw) || 0;
      if (valB !== valA) {
        return valB - valA;
      }
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [assets]);

  // 예수금(현금 자산) 잔고 합산 계산
  const cashBalance = useMemo(() => {
    return assets
      .filter((a) => a.category === 'CASH' || a.ticker === 'KRW' || a.ticker === 'USD')
      .reduce((sum, a) => sum + (a.valuation_krw || 0), 0);
  }, [assets]);

  if (!account) return null;

  return (
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl overflow-hidden transition-all">
      {/* 계좌 요약 헤더 (터치 시 펼침/접힘) */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={`${provider} ${name} 계좌 상세`}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F9FAFB] active:bg-[#F2F4F6] transition-colors"
      >
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F2F4F6] text-[#4E5968]">
              {provider}
            </span>
            <span className="text-[13px] font-bold text-[#191F28] truncate">{maskValue(name)}</span>
          </div>
          {alias && <p className="text-xs text-[#8B95A1] font-medium truncate mt-1">{alias}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0 tabular-nums">
          <div className="text-right">
            <div className="text-sm font-bold text-[#191F28]">
              {maskValue(Math.round(total_valuation_krw).toLocaleString())}
              <span className="text-[11px] font-medium text-[#6B7684] ml-0.5">원</span>
            </div>
            <div className="text-[11px] text-[#8B95A1] font-medium mt-0.5">
              예수금 {maskValue(Math.round(cashBalance).toLocaleString())}원
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#8B95A1] transition-transform duration-200 ${
              isExpanded ? 'rotate-180 text-[#3182F6]' : ''
            }`}
          />
        </div>
      </button>

      {/* 아코디언 펼침 내용: 보유 종목 플랫 리스트 */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-2 border-t border-[#F2F4F6]">
          <div className="flex items-center justify-between text-[11px] font-medium text-[#8B95A1] pb-2">
            <span>보유 종목 ({sortedAssets.length}개)</span>
            <span>평가금액 (KRW)</span>
          </div>

          {sortedAssets.length === 0 ? (
            <div className="py-5 text-center text-xs text-[#8B95A1] font-medium">
              보유 종목이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-[#F2F4F6]">
              {sortedAssets.map((asset, idx) => {
                const isUsd = asset.country === 'US' || asset.ticker === 'USD';
                return (
                  <div
                    key={`${asset.id || asset.ticker}-${idx}`}
                    className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[#191F28] truncate">
                          {asset.name}
                        </span>
                        {asset.country && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              asset.country === 'KR'
                                ? 'bg-[#E8F3FF] text-[#3182F6]'
                                : 'bg-[#FFF0F1] text-[#F04452]'
                            }`}
                          >
                            {asset.country}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#8B95A1] font-medium tabular-nums">
                        <span>{asset.ticker}</span>
                        <span>·</span>
                        <span>{asset.category || '기타'}</span>
                        <span>·</span>
                        <span>{maskValue(asset.quantity?.toLocaleString())}주</span>
                        <span>@ {asset.price?.toLocaleString()} {isUsd ? 'USD' : 'KRW'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-[13px] font-bold text-[#191F28]">
                        {maskValue(Math.round(asset.valuation_krw || 0).toLocaleString())}
                        <span className="text-[11px] font-normal text-[#6B7684] ml-0.5">원</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
