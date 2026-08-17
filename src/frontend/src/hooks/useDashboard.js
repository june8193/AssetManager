import { useState, useEffect } from 'react';
import { dashboardService } from '../services';

/**
 * 대시보드 데이터를 조회하고 새로고침하는 커스텀 훅
 */
export const useDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async (force = false) => {
    setLoading(true);
    try {
      let refreshResult = null;
      if (force) {
        try {
          refreshResult = await dashboardService.refresh();
        } catch {
          throw new Error('시세를 새로고침하는 중 오류가 발생했습니다.');
        }
      }

      const [summary, yearly, daily, snapshots] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getYearly(),
        dashboardService.getDaily({ all: true }),
        dashboardService.getSnapshots({ all: true }),
      ]);

      setData({ ...summary, yearly, daily, snapshots });
      setError(null);
      return refreshResult;
    } catch (err) {
      setError(err.message || '데이터를 가져오는데 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard().catch(() => {});
  }, []);

  return { data, loading, error, refresh: fetchDashboard };
};
