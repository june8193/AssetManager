import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import WatchlistPage from './pages/WatchlistPage';
import ConnectionPage from './pages/ConnectionPage';
import DbManagementPage from './pages/DbManagementPage';
function App() {
  return (
    <Router>
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/watchlist/:country" element={<WatchlistPage />} />
            <Route path="/connection" element={<ConnectionPage />} />
            <Route path="/db" element={<DbManagementPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
