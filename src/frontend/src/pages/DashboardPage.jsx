import React from 'react';
import { useParams } from 'react-router-dom';
import WatchlistForm from '../components/WatchlistForm';
import WatchlistTable from '../components/WatchlistTable';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWebSocket } from '../hooks/useWebSocket';

const DashboardPage = () => {
  const { country = 'kr' } = useParams();
  const { watchlist, loading, error, addToWatchlist, removeFromWatchlist } = useWatchlist(country);
  const { realtimeData } = useWebSocket();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 p-6 bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <h1 className="text-3xl font-bold font-headline tracking-tight mb-2 relative z-10">
          관심종목 현황 ({country === 'us' ? '미국' : '국내'})
        </h1>
        <p className="text-indigo-200 max-w-2xl text-sm relative z-10">
          실시간 주가 데이터를 반영하여 {country === 'us' ? '미국' : '국내'} 관심종목의 현재 가격과 등락률을 모니터링합니다. 
          {country === 'us' ? ' 미국 주식은 yfinance를 통해 5초 주기로 실시간 데이터를 수신합니다.' : ' 국내 주식은 키움 API를 통해 실시간 데이터를 직접 수신합니다.'}
        </p>
      </div>

      <WatchlistForm onAdd={(code, name) => addToWatchlist(code, name, country)} error={error} country={country} />
      
      <WatchlistTable 
        watchlist={watchlist} 
        realtimeData={realtimeData} 
        onRemove={removeFromWatchlist}
        loading={loading}
      />
    </main>
  );
};

export default DashboardPage;
