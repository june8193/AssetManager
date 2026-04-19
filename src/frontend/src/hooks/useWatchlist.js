import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000/api/watchlist';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setWatchlist(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToWatchlist = async (stockCode, stockName) => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stock_code: stockCode, stock_name: stockName }),
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

  return {
    watchlist,
    loading,
    error,
    addToWatchlist,
    removeFromWatchlist
  };
}
