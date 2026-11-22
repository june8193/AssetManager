import { useState, useEffect } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { dbService } from '../../services';
import { useMasking } from '../../contexts/MaskingContext';
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast, MobileErrorCard } from '../../components/mobile/MobileStatusFeedback';
import MobileAccountCard from '../../components/mobile/MobileAccountCard';
import MobileTransactionList from '../../components/mobile/MobileTransactionList';

/**
 * 모바일 자산 및 거래내역 조회 페이지 컴포넌트 (Read-Only, 클린 라이트 톤)
 * - 상단 서브탭: [계좌별 자산] / [거래내역] 전환
 * - 계좌별 자산 아코디언 카드 뷰 (예수금, 보유 종목, 평가액)
 * - 전체 거래내역 리스트 뷰 (계좌 필터, 거래유형 필터, 키워드 검색)
 * - 단일 헤더 새로고침 버튼 및 마스킹 연동
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

  useMobileHeaderRefresh(handleRefresh, isRefreshing);

  // 로딩 상태 (모바일 스켈레톤)
  if (dashboardLoading) {
    return (
      <div className="space-y-3 animate-pulse max-w-md mx-auto">
        <div className="h-11 bg-white border border-[#E5E8EB]/60 rounded-xl" />
        <div className="h-24 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        <div className="h-28 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
          <span className="text-xs text-[#8B95A1] font-medium">자산 데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (dashboardError) {
    return <MobileErrorCard message={dashboardError} onRetry={() => refresh()} />;
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
    <div className="space-y-3 max-w-md mx-auto relative pb-4">
      <MobileToast toast={toastMessage} />

      {/* 상단 서브탭 전환 바 */}
      <div className="flex p-1 bg-[#E5E8EB]/70 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center ${
            activeTab === 'accounts'
              ? 'bg-white text-[#191F28] font-semibold shadow-xs'
              : 'text-[#6B7684] hover:text-[#191F28] font-medium'
          }`}
        >
          계좌별 자산
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center ${
            activeTab === 'transactions'
              ? 'bg-white text-[#191F28] font-semibold shadow-xs'
              : 'text-[#6B7684] hover:text-[#191F28] font-medium'
          }`}
        >
          거래내역
        </button>
      </div>

      {/* 탭 1: 계좌별 자산 뷰 */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          {/* 전체 요약 배너 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-4 flex items-center justify-between tabular-nums">
            <div>
              <p className="text-xs text-[#8B95A1] font-medium">전체 계좌 ({accounts.length}개)</p>
              <div className="text-lg font-bold text-[#191F28] mt-0.5">
                {maskValue(Math.round(totalValuation).toLocaleString())}
                <span className="text-xs font-semibold text-[#6B7684] ml-0.5">원</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#8B95A1] font-medium block">총 예수금</span>
              <div className="text-xs font-semibold text-[#4E5968] mt-0.5">
                {maskValue(Math.round(totalCashBalance).toLocaleString())}
                <span className="text-[11px] font-normal text-[#8B95A1] ml-0.5">원</span>
              </div>
            </div>
          </section>

          {/* 계좌별 아코디언 카드 리스트 */}
          {accounts.length === 0 ? (
            <div className="py-12 text-center bg-white border border-[#E5E8EB]/60 rounded-2xl">
              <Wallet className="w-7 h-7 text-[#CBD5E1] mx-auto mb-2" />
              <p className="text-xs text-[#8B95A1] font-medium">등록된 계좌가 없습니다.</p>
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
        <div>
          {txLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
              <span className="text-xs text-[#8B95A1] font-medium">거래내역을 불러오는 중...</span>
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
