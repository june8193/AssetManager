import { useState, useEffect } from 'react';

const WS_URL = 'ws://localhost:8000/ws';

export function useWebSocket() {
  const [realtimeData, setRealtimeData] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket 연결 성공');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'price_update' && message.data) {
          // 배열 구조의 최신 데이터를 객체 맵 형태로 변환하여 상태 업데이트
          // 예: { "005930": { current_price: 80000, change_rate: "1.50" }, ... }
          const newDataMap = {};
          message.data.forEach(item => {
            newDataMap[item.stock_code] = {
              current_price: item.current_price,
              change_rate: item.change_rate
            };
          });
          
          setRealtimeData(prev => ({
            ...prev,
            ...newDataMap
          }));
        }
      } catch (err) {
        console.error('WebSocket 데이터 파싱 오류:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket 오류:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket 연결 종료');
    };

    return () => {
      ws.close();
    };
  }, []);

  return { realtimeData, isConnected };
}
