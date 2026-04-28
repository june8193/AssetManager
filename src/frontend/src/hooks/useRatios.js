import { useState, useEffect } from 'react';

export const useRatios = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState([]);
  const [rebalancing, setRebalancing] = useState(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ratios/targets');
      if (!response.ok) throw new Error('목표 비중을 가져오는데 실패했습니다.');
      const data = await response.json();
      setTargets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateTargets = async (newTargets) => {
    try {
      setLoading(true);
      const response = await fetch('/api/ratios/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTargets)
      });
      if (!response.ok) throw new Error('목표 비중을 저장하는데 실패했습니다.');
      await fetchTargets();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const calculateRebalancing = async (additionalCash = 0) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ratios/rebalancing?additional_cash=${additionalCash}`);
      if (!response.ok) throw new Error('리밸런싱 계산에 실패했습니다.');
      const data = await response.json();
      setRebalancing(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  return {
    loading,
    error,
    targets,
    rebalancing,
    updateTargets,
    calculateRebalancing,
    refreshTargets: fetchTargets
  };
};
