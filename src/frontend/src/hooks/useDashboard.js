import { useState, useEffect } from 'react';

export const useDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('대시보드 데이터를 가져오는데 실패했습니다.');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return { data, loading, error, refresh: fetchDashboard };
};
