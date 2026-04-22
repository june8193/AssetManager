import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WatchlistForm from '../components/WatchlistForm';
import WatchlistTable from '../components/WatchlistTable';
import { useWatchlist } from '../hooks/useWatchlist';

const WatchlistPage = () => {
  const { country: urlCountry } = useParams();
  const navigate = useNavigate();
  const country = urlCountry || 'kr';

  const { watchlist, loading, error, addToWatchlist, removeFromWatchlist, realtimeData } = useWatchlist(country);

  const handleCountryChange = (newCountry) => {
    if (newCountry !== country) {
      navigate(`/watchlist/${newCountry}`);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 p-6 bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <h1 className="text-3xl font-bold font-headline tracking-tight mb-2 relative z-10">
          관심종목 현황 ({country === 'us' ? '미국' : '국내'})
        </h1>
        <p className="text-indigo-200 max-w-2xl text-sm relative z-10">
          {country === 'us' ? '미국' : '국내'} 관심종목의 현재 가격과 등락률을 5초 주기로 모니터링합니다. 
          {country === 'us' ? ' 미국 주식은 yfinance 데이터를 통해 실시간 시세를 조회합니다.' : ' 국내 주식은 키움 API를 통해 실시간 시세를 조회합니다.'}
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => handleCountryChange('kr')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${country === 'kr' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          국내 주식 (KR)
        </button>
        <button 
          onClick={() => handleCountryChange('us')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${country === 'us' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          미국 주식 (US)
        </button>
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

export default WatchlistPage;
