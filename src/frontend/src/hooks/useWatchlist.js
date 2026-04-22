import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000/api/watchlist';

export function useWatchlist(country = 'kr') {
  const [watchlist, setWatchlist] = useState([]);
  const [realtimeData, setRealtimeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrices = useCallback(async () => {
    if (!country) return;
    try {
      const response = await fetch(`${API_BASE_URL}/prices?country=${country.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        const newDataMap = {};
        data.forEach(item => {
          newDataMap[item.stock_code] = {
            current_price: item.current_price,
            change_rate: item.change_rate
          };
        });
        setRealtimeData(newDataMap);
      }
    } catch (err) {
      console.error('시세 정보 조회 실패:', err);
    }
  }, [country]);

  const fetchWatchlist = useCallback(async () => {
    if (!country) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}?country=${country.toUpperCase()}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setWatchlist(data);
      setError(null);
      
      // 초기 시세 가져오기
      await fetchPrices();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [country, fetchPrices]);

  const addToWatchlist = async (stockCode, stockName, countryCode) => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          stock_code: stockCode, 
          stock_name: stockName,
          country: countryCode.toUpperCase()
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || '항목 추가에 실패했습니다.');
      }
      
      await fetchWatchlist();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const removeFromWatchlist = async (stockCode) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${stockCode}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('항목 삭제에 실패했습니다.');
      
      setWatchlist(prev => prev.filter(item => item.stock_code !== stockCode));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // 5초마다 시세 정보 폴링
  useEffect(() => {
    if (!country) return;
    
    const interval = setInterval(() => {
      fetchPrices();
    }, 5000);

    return () => clearInterval(interval);
  }, [country, fetchPrices]);

  return {
    watchlist,
    realtimeData,
    loading,
    error,
    addToWatchlist,
    removeFromWatchlist
  };
}
