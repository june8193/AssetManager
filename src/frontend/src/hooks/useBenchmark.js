import { useState, useEffect, useCallback } from 'react';

export const useBenchmark = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("YTD");
  const [activeWatchlistDataset, setActiveWatchlistDataset] = useState({});

  const fetchBenchmark = useCallback(async (currentPeriod = period, keepWatchlist = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/benchmark?period=${currentPeriod}`);
      if (!response.ok) {
        throw new Error('벤치마크 데이터를 가져오는데 실패했습니다.');
      }
      const result = await response.json();
      setData(result);
      setError(null);

      // 기간(period) 변경 시, 기존에 차트에 활성화되어 있던 관심 종목의 시계열도 새 기간 범위에 맞춰 다시 비동기 로딩합니다.
      if (keepWatchlist) {
        const activeTickers = Object.keys(activeWatchlistDataset);
        if (activeTickers.length > 0) {
          const promises = activeTickers.map(ticker =>
            fetch(`/api/benchmark/historical?ticker=${ticker}&period=${currentPeriod}`)
              .then(res => {
                if (!res.ok) throw new Error(`${ticker} 조회 실패`);
                return res.json();
              })
              .then(hist => ({ ticker, data: hist }))
              .catch(err => {
                console.error(err);
                return null;
              })
          );
          const results = await Promise.all(promises);
          const newActive = {};
          results.forEach(res => {
            if (res) {
              newActive[res.ticker] = res.data;
            }
          });
          setActiveWatchlistDataset(newActive);
        }
      } else {
        // 새로고침이나 최초 로드 시에는 관심종목 데이터셋을 비워둡니다.
        setActiveWatchlistDataset({});
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, activeWatchlistDataset]);

  // 관심 종목 토글 체크박스 선택/해제 처리
  const toggleWatchlistStock = async (stockCode) => {
    if (activeWatchlistDataset[stockCode]) {
      // 이미 활성화된 경우 제거
      const updated = { ...activeWatchlistDataset };
      delete updated[stockCode];
      setActiveWatchlistDataset(updated);
    } else {
      // 비활성화된 경우 백엔드에서 비동기로 시계열 로딩하여 캐싱 추가
      try {
        const response = await fetch(`/api/benchmark/historical?ticker=${stockCode}&period=${period}`);
        if (!response.ok) {
          throw new Error('종목 과거 데이터를 가져오는데 실패했습니다.');
        }
        const histData = await response.json();
        setActiveWatchlistDataset(prev => ({
          ...prev,
          [stockCode]: histData
        }));
      } catch (err) {
        console.error(`⚠️ [useBenchmark] 관심종목 시계열 로딩 실패:`, err);
        alert(`관심 종목 데이터를 가져오지 못했습니다: ${err.message}`);
      }
    }
  };

  useEffect(() => {
    fetchBenchmark(period, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return {
    data,
    loading,
    error,
    period,
    setPeriod,
    refresh: () => fetchBenchmark(period, false),
    toggleWatchlistStock,
    activeWatchlistDataset
  };
};
