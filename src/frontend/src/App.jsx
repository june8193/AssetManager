import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import WatchlistPage from './pages/WatchlistPage';
import ConnectionPage from './pages/ConnectionPage';
import DataInputPage from './pages/DataInputPage';
import DbManagementPage from './pages/DbManagementPage';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { isConnected } = useWebSocket();

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <Sidebar isConnected={isConnected} />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/watchlist/:country" element={<WatchlistPage />} />
            <Route path="/connection" element={<ConnectionPage />} />
            <Route path="/db" element={<DbManagementPage />} />
            <Route path="/input" element={<DataInputPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
