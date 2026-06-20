import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MaskingProvider } from './contexts/MaskingContext';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import BenchmarkPage from './pages/BenchmarkPage';
import SectorPage from './pages/SectorPage';
import ConnectionPage from './pages/ConnectionPage';
import DbManagementPage from './pages/DbManagementPage';
import RatioCheckPage from './pages/RatioCheckPage';
import SnapshotWizardPage from './pages/SnapshotWizardPage';
import TitleManager from './components/TitleManager';

function App() {

  return (
    <Router>
      <TitleManager />
      <MaskingProvider>
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/benchmark" element={<BenchmarkPage />} />
              <Route path="/benchmark/compare-returns" element={<SectorPage />} />
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
