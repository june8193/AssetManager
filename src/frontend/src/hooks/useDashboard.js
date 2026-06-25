import { useState, useEffect } from 'react';

export const useDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [summaryRes, yearlyRes, dailyRes, snapshotsRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/yearly'),
        fetch('/api/dashboard/daily?all=true'),
        fetch('/api/dashboard/snapshots?all=true')
      ]);

      if (!summaryRes.ok || !yearlyRes.ok || !dailyRes.ok || !snapshotsRes.ok) {
        throw new Error('데이터를 가져오는데 실패했습니다.');
      }

      const summary = await summaryRes.json();
      const yearly = await yearlyRes.json();
      const daily = await dailyRes.json();
      const snapshots = await snapshotsRes.json();

      setData({ ...summary, yearly, daily, snapshots });
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
