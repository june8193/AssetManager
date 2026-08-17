import { useState, useEffect } from 'react';
import { ratioService } from '../services';

/**
 * 자산 배분 비중 및 리밸런싱을 관리하는 커스텀 훅
 */
export const useRatios = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [rebalancing, setRebalancing] = useState(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const data = await ratioService.getTargets();
      setTargets(data);
    } catch (err) {
      setError(err.message || '목표 비중을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const data = await ratioService.getHierarchy();
      setHierarchy(data);
    } catch (err) {
      setError(err.message || '계층 구조를 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateTargets = async (newTargets) => {
    try {
      setLoading(true);
      await ratioService.saveTargets(newTargets);
      await fetchTargets();
      await fetchHierarchy();
    } catch (err) {
      setError(err.message || '목표 비중을 저장하는데 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const calculateRebalancing = async (additionalCash = 0) => {
    try {
      setLoading(true);
      const data = await ratioService.getRebalancing(additionalCash);
      setRebalancing(data);
    } catch (err) {
      setError(err.message || '리밸런싱 계산에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
    fetchHierarchy();
  }, []);

  return {
    loading,
    error,
    targets,
    hierarchy,
    rebalancing,
    updateTargets,
    calculateRebalancing,
    refreshTargets: fetchTargets,
    refreshHierarchy: fetchHierarchy,
  };
};
