import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

const TASK_NAMES = {
  exchange_rate_update: '환율 자동 수집',
  price_update: '시세 자동 수집',
  db_backup: '데이터베이스 자동 백업',
  stock_sync: '주식 종목 동기화',
};

/**
 * 백그라운드 태스크 중 실패(failed) 상태인 작업을 감지하여 대시보드 상단에 알림 배너를 표출합니다.
 */
const TaskAlertBanner = () => {
  const [failedTasks, setFailedTasks] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchTaskStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/system/tasks/status`);
        if (res.ok) {
          const data = await res.json();
          const failures = [];
          Object.keys(data).forEach((key) => {
            if (data[key] && data[key].status === 'failed') {
              failures.push({
                key,
                name: TASK_NAMES[key] || key,
                error: data[key].last_error || '알 수 없는 오류가 발생했습니다.',
                time: data[key].last_error_time,
              });
            }
          });
          setFailedTasks(failures);
        }
      } catch (err) {
        console.error('태스크 상태 조회 중 오류:', err);
      }
    };

    fetchTaskStatus();
    // 30초마다 백그라운드 태스크 상태 주기적 폴링 (Polling)
    const intervalId = setInterval(fetchTaskStatus, 30000);
    return () => clearInterval(intervalId);
  }, []);

  if (dismissed || failedTasks.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="task-alert-banner"
      className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-amber-200 backdrop-blur-sm shadow-lg relative"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0 animate-pulse" />
          <div>
            <h4 className="font-semibold text-amber-300 text-sm mb-1">
              ⚠️ 백그라운드 시스템 태스크 오류 발생 ({failedTasks.length}건)
            </h4>
            <ul className="space-y-1 text-xs text-amber-200/90">
              {failedTasks.map((task) => (
                <li key={task.key} className="flex items-center space-x-2">
                  <span className="font-medium bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">
                    [{task.name} 실패]
                  </span>
                  <span>{task.error}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-200 transition-colors p-1 rounded-md hover:bg-amber-500/20"
          title="배너 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TaskAlertBanner;
