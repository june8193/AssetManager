import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import ConnectionPage from './pages/ConnectionPage';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { isConnected } = useWebSocket();

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Navbar isConnected={isConnected} />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/connection" element={<ConnectionPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
