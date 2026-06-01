import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MaskingProvider } from './contexts/MaskingContext';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import WatchlistPage from './pages/WatchlistPage';
import BenchmarkPage from './pages/BenchmarkPage';
import ConnectionPage from './pages/ConnectionPage';
import DbManagementPage from './pages/DbManagementPage';
import RatioCalculatorPage from './pages/RatioCalculatorPage';
import RatioCheckPage from './pages/RatioCheckPage';
import SnapshotWizardPage from './pages/SnapshotWizardPage';

function App() {
  useEffect(() => {
    // 개발 모드에서만 동작
    if (!import.meta.env.DEV) return;

    let socket;
    let heartbeatInterval;
    let reconnectTimeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/dev/heartbeat`;
      
      console.log(`[Heartbeat] Connecting to ${wsUrl}...`);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[Heartbeat] Connected to backend');
        // 5초마다 하트비트 전송
        heartbeatInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('heartbeat');
          }
        }, 5000);
      };

      socket.onclose = () => {
        console.log('[Heartbeat] Disconnected. Reconnecting in 3s...');
        clearInterval(heartbeatInterval);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error('[Heartbeat] WebSocket error:', error);
        socket.close();
      };
    };

    connect();

    // Cleanup
    return () => {
      if (socket) socket.close();
      clearInterval(heartbeatInterval);
      clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <Router>
      <MaskingProvider>
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/benchmark" element={<BenchmarkPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/watchlist/:country" element={<WatchlistPage />} />
              <Route path="/ratios" element={<RatioCalculatorPage />} />
              <Route path="/ratios/check" element={<RatioCheckPage />} />
              <Route path="/connection" element={<ConnectionPage />} />
              <Route path="/db" element={<DbManagementPage />} />
              <Route path="/db/snapshots/new" element={<SnapshotWizardPage />} />
            </Routes>
          </div>
        </div>
      </MaskingProvider>
    </Router>
  );
}

export default App;
