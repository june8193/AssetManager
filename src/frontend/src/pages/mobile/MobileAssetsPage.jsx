import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Wallet, ArrowLeftRight, Coins } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { dbService } from '../../services';
import { useMasking } from '../../contexts/MaskingContext';
import MobileAccountCard from '../../components/mobile/MobileAccountCard';
import MobileTransactionList from '../../components/mobile/MobileTransactionList';

/**
 * 모바일 자산 및 거래내역 조회 페이지 컴포넌트 (Read-Only)
 * - 상단 서브탭: [계좌별 자산] / [거래내역] 전환
 * - 계좌별 자산 아코디언 카드 뷰 (예수금, 보유 종목, 평가액)
 * - 전체 거래내역 리스트 뷰 (계좌 필터, 거래유형 필터, 키워드 검색)
 * - 실시간 시세 새로고침 버튼 및 마스킹 연동
 */
export default function MobileAssetsPage() {
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refresh } = useDashboard();
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'transactions'
  const [transactions, setTransactions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const { maskValue } = useMasking();

  // 거래 내역 및 자산 마스터 데이터 로드
  const fetchTransactionsData = async () => {
    try {
      setTxLoading(true);
      const [txData, assetData] = await Promise.all([
        dbService.getTransactions().catch(() => []),
        dbService.getAssets().catch(() => []),
      ]);
      setTransactions(txData || []);
      setAssets(assetData || []);
    } catch (err) {
      console.error('거래 데이터 로드 실패:', err);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionsData();
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage(null);
    try {
      const [refreshResult] = await Promise.all([
        refresh(true),
        fetchTransactionsData(),
      ]);

      if (refreshResult) {
        if (refreshResult.status === 'success') {
          setToastMessage({ type: 'success', text: refreshResult.message || '시세가 최신화되었습니다.' });
        } else if (refreshResult.status === 'skipped') {
          setToastMessage({ type: 'info', text: refreshResult.message || '시세 최신화가 건너뛰어졌습니다.' });
        }
      } else {
        setToastMessage({ type: 'success', text: '자산 데이터가 최신화되었습니다.' });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.message || '새로고침 중 오류가 발생했습니다.',
      });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    }
  };

  // 로딩 상태 (모바일 스켈레톤)
  if (dashboardLoading) {
    return (
      <div className="space-y-4 animate-pulse py-2">
        <div className="flex items-center justify-between px-1">
          <div className="h-5 w-24 bg-slate-800 rounded-lg" />
          <div className="h-8 w-24 bg-slate-800 rounded-xl" />
        </div>
        <div className="h-12 bg-slate-900 border border-slate-800 rounded-2xl" />
        <div className="h-36 bg-slate-900 border border-slate-800 rounded-2xl" />
        <div className="h-36 bg-slate-900 border border-slate-800 rounded-2xl" />
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">자산 데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (dashboardError) {
    return (
      <div className="py-12 px-4 text-center">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 flex flex-col items-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">데이터 로드 실패</h2>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">{dashboardError}</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const accounts = dashboardData?.accounts || [];
  const totalValuation = dashboardData?.total_valuation_krw || 0;

  // 전체 예수금 계산
  const totalCashBalance = accounts.reduce((accSum, acc) => {
    const cash = (acc.assets || [])
      .filter((a) => a.category === 'CASH' || a.ticker === 'KRW' || a.ticker === 'USD')
      .reduce((sum, a) => sum + (a.valuation_krw || 0), 0);
    return accSum + cash;
  }, 0);

  return (
    <div className="space-y-4 max-w-md mx-auto relative pb-4">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          className={`sticky top-2 z-30 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all text-center animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : toastMessage.type === 'info'
              ? 'bg-sky-500 text-white shadow-sky-500/20'
              : 'bg-rose-500 text-white shadow-rose-500/20'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* 페이지 헤더 & 새로고침 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">자산 조회</h2>
          <p className="text-[10px] text-slate-400 font-medium">계좌별 잔고 및 거래내역</p>
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

      {/* 상단 서브탭 전환 바 */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'accounts'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>계좌별 자산</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'transactions'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>거래내역</span>
        </button>
      </div>

      {/* 탭 1: 계좌별 자산 뷰 */}
      {activeTab === 'accounts' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* 전체 요약 미니 배너 */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] text-slate-400 font-medium">전체 계좌 ({accounts.length}개)</p>
              <div className="text-base font-extrabold text-white mt-0.5 font-mono">
                {maskValue(Math.round(totalValuation).toLocaleString())}
                <span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-medium">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>총 예수금</span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-0.5 font-mono">
                {maskValue(Math.round(totalCashBalance).toLocaleString())}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">원</span>
              </div>
            </div>
          </div>

          {/* 계좌별 아코디언 카드 리스트 */}
          {accounts.length === 0 ? (
            <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
              <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">등록된 계좌가 없습니다.</p>
            </div>
          ) : (
            accounts.map((account) => (
              <MobileAccountCard key={account.id} account={account} />
            ))
          )}
        </div>
      )}

      {/* 탭 2: 거래내역 뷰 */}
      {activeTab === 'transactions' && (
        <div className="animate-in fade-in duration-200">
          {txLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">거래내역을 불러오는 중...</span>
            </div>
          ) : (
            <MobileTransactionList
              transactions={transactions}
              accounts={accounts}
              assets={assets}
            />
          )}
        </div>
      )}
    </div>
  );
}
