import React from 'react';
import WatchlistForm from '../components/WatchlistForm';
import WatchlistTable from '../components/WatchlistTable';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWebSocket } from '../hooks/useWebSocket';

const DashboardPage = () => {
  const { watchlist, loading, error, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { realtimeData } = useWebSocket();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 p-6 bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <h1 className="text-3xl font-bold font-headline tracking-tight mb-2 relative z-10">
          관심종목 현황
        </h1>
        <p className="text-indigo-200 max-w-2xl text-sm relative z-10">
          실시간 주가 데이터를 반영하여 관심종목의 현재 가격과 등락률을 모니터링합니다. Mock WebSocket 서버에서 1초마다 가격 변동을 브로드캐스트합니다.
        </p>
      </div>

      <WatchlistForm onAdd={addToWatchlist} error={error} />
      
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
