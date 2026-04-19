import { Activity } from 'lucide-react';
import WatchlistForm from './components/WatchlistForm';
import WatchlistTable from './components/WatchlistTable';
import { useWatchlist } from './hooks/useWatchlist';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { watchlist, loading, error, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { realtimeData, isConnected } = useWebSocket();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-600 mb-0.5" size={24} />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 font-headline tracking-tight">
              AssetManager
            </span>
          </div>
          <div className="flex items-center text-sm">
            {isConnected ? (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-2 font-medium border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                실시간 연동 중
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full flex items-center gap-2 font-medium border border-red-100">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                연결 끊김
              </span>
            )}
          </div>
        </div>
      </header>

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
    </div>
  );
}

export default App;
