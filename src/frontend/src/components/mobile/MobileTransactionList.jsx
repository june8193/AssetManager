import { useState, useMemo } from 'react';
import { Search, Filter, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 거래 유형 뱃지 스타일 헬퍼
 *
 * @param {string} type - 거래 유형
 * @returns {{ label: string, style: string }}
 */
const getTransactionBadgeProps = (type) => {
  switch (type) {
    case 'BUY':
      return { label: '매수', style: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' };
    case 'SELL':
      return { label: '매도', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
    case 'DEPOSIT':
      return { label: '입금', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    case 'WITHDRAW':
      return { label: '출금', style: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    case 'TRANSFER':
      return { label: '이체', style: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' };
    case 'EXCHANGE':
      return { label: '환전', style: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' };
    case 'DIVIDEND':
      return { label: '배당', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    case 'INTEREST':
      return { label: '이자', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    case 'TAX':
      return { label: '세금', style: 'bg-slate-700 text-slate-300 border border-slate-600' };
    case 'CASH_ADJUSTMENT':
      return { label: '보정', style: 'bg-slate-700 text-slate-300 border border-slate-600' };
    default:
      return { label: type || '기타', style: 'bg-slate-800 text-slate-400 border border-slate-700' };
  }
};

/**
 * 모바일 거래내역 조회 및 필터/검색 리스트 컴포넌트 (Read-Only)
 * - 계좌별 필터, 거래 유형별 필터, 키워드 실시간 검색
 * - 읽기 전용으로 추가/수정/삭제 버튼 일체 배제
 * - 마스킹(MaskingContext) 완벽 연동
 *
 * @param {Object} props
 * @param {Array} props.transactions - 전체 거래내역 배열
 * @param {Array} props.accounts - 계좌 목록 배열
 * @param {Array} props.assets - 자산 마스터 배열
 */
export default function MobileTransactionList({
  transactions = [],
  accounts = [],
  assets = [],
}) {
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { maskValue } = useMasking();

  // 계좌 및 자산 Map 캐싱
  const accountMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(String(acc.id), acc));
    return map;
  }, [accounts]);

  const assetMap = useMemo(() => {
    const map = new Map();
    assets.forEach((ast) => map.set(String(ast.id), ast));
    return map;
  }, [assets]);

  // 필터 및 검색 적용된 거래 목록
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. 계좌 필터
      if (accountFilter !== 'all' && String(tx.account_id) !== String(accountFilter)) {
        return false;
      }

      // 2. 거래 유형 필터
      if (typeFilter !== 'all') {
        if (typeFilter === 'TRADE') {
          if (tx.type !== 'BUY' && tx.type !== 'SELL') return false;
        } else if (typeFilter === 'CASH_FLOW') {
          if (tx.type !== 'DEPOSIT' && tx.type !== 'WITHDRAW' && tx.type !== 'TRANSFER') return false;
        } else if (typeFilter === 'DIVIDEND_INTEREST') {
          if (tx.type !== 'DIVIDEND' && tx.type !== 'INTEREST') return false;
        } else if (tx.type !== typeFilter) {
          return false;
        }
      }

      // 3. 검색어 필터 (종목명, 티커, 계좌명, 메모 등)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const asset = assetMap.get(String(tx.asset_id));
        const account = accountMap.get(String(tx.account_id));
        const ticker = (asset?.ticker || '').toLowerCase();
        const assetName = (asset?.name || '').toLowerCase();
        const accountName = (account?.name || '').toLowerCase();
        const accountProvider = (account?.provider || '').toLowerCase();
        const memo = (tx.memo || '').toLowerCase();
        const type = (tx.type || '').toLowerCase();

        const isMatch =
          ticker.includes(query) ||
          assetName.includes(query) ||
          accountName.includes(query) ||
          accountProvider.includes(query) ||
          memo.includes(query) ||
          type.includes(query);

        if (!isMatch) return false;
      }

      return true;
    });
  }, [transactions, accountFilter, typeFilter, searchQuery, accountMap, assetMap]);

  return (
    <div className="space-y-3">
      {/* 필터 및 검색 헤더 바 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-md">
        {/* 검색 인풋 */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="종목명, 티커, 계좌명, 메모 검색"
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* 필터 셀렉트 그리드 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="account-filter-select" className="sr-only">
              계좌 필터
            </label>
            <select
              id="account-filter-select"
              aria-label="계좌 필터"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="all">전체 계좌</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.provider} {acc.name} {acc.alias ? `(${acc.alias})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="type-filter-select" className="sr-only">
              유형 필터
            </label>
            <select
              id="type-filter-select"
              aria-label="유형 필터"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="all">전체 거래 유형</option>
              <option value="BUY">매수 (BUY)</option>
              <option value="SELL">매도 (SELL)</option>
              <option value="DEPOSIT">입금 (DEPOSIT)</option>
              <option value="WITHDRAW">출금 (WITHDRAW)</option>
              <option value="TRANSFER">이체 (TRANSFER)</option>
              <option value="EXCHANGE">환전 (EXCHANGE)</option>
              <option value="DIVIDEND">배당 (DIVIDEND)</option>
              <option value="INTEREST">이자 (INTEREST)</option>
              <option value="TRADE">매매 (매수/매도)</option>
              <option value="CASH_FLOW">입출금/이체</option>
              <option value="DIVIDEND_INTEREST">배당/이자</option>
            </select>
          </div>
        </div>
      </div>

      {/* 거래 건수 요약 */}
      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
        <span>거래 내역 ({filteredTransactions.length}건)</span>
        {(accountFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setAccountFilter('all');
              setTypeFilter('all');
              setSearchQuery('');
            }}
            className="text-sky-400 hover:text-sky-300 font-semibold"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 거래 목록 리스트 */}
      {filteredTransactions.length === 0 ? (
        <div className="py-12 px-4 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
          <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">거래 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((tx) => {
            const isExchangeTx = tx.type === 'EXCHANGE';
            const isTransferTx = !!tx.transfer_pair_id || tx.type === 'TRANSFER';
            const srcAsset = assetMap.get(String(tx.asset_id));
            const targetAsset = tx.target_asset_id ? assetMap.get(String(tx.target_asset_id)) : null;
            const account = accountMap.get(String(tx.account_id));
            const badge = getTransactionBadgeProps(tx.type);

            const tickerDisplay = isExchangeTx
              ? `${srcAsset?.ticker || tx.asset_id} ➔ ${targetAsset?.ticker || tx.target_asset_id || '?'}`
              : srcAsset?.ticker || tx.asset_id;

            const nameDisplay = isExchangeTx
              ? `${srcAsset?.name || ''} ➔ ${targetAsset?.name || ''}`
              : srcAsset?.name || '';

            const safeQuantity = tx.quantity ?? 0;
            const safePrice = tx.price ?? 0;
            const safeTotal = tx.total_amount ?? 0;

            return (
              <div
                key={tx.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2 hover:border-slate-700 transition-colors"
              >
                {/* 상단: 일자 / 계좌 / 유형 배지 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {tx.transaction_date}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] font-bold text-slate-300 truncate">
                      {account?.provider ? `${account.provider} ${account.name}` : tx.account_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.style}`}>
                      {badge.label}
                    </span>
                    {isTransferTx && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        이체
                      </span>
                    )}
                  </div>
                </div>

                {/* 중앙: 종목명 / 티커 / 거래 총액 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{nameDisplay || tickerDisplay}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{tickerDisplay}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-extrabold text-white font-mono">
                      {maskValue(safeTotal.toLocaleString())}
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">{tx.currency || 'KRW'}</span>
                    </div>
                  </div>
                </div>

                {/* 하단: 수량 @ 단가 및 메모 */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <div>
                    <span>수량: </span>
                    <span className="text-slate-300 font-semibold font-mono">
                      {maskValue(safeQuantity.toLocaleString())}
                    </span>
                    <span className="mx-1">@</span>
                    <span>단가: </span>
                    <span className="text-slate-300 font-semibold font-mono">
                      {maskValue(safePrice.toLocaleString())} {tx.currency || 'KRW'}
                    </span>
                  </div>

                  {tx.memo && (
                    <div className="text-slate-400 truncate max-w-[130px] font-normal text-[10px]">
                      {tx.memo}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
