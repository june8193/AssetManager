import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MaskingProvider } from './contexts/MaskingContext';
import useIsMobile from './hooks/useIsMobile';
import Sidebar from './components/Sidebar';
import MobileLayout from './components/mobile/MobileLayout';
import MobileRouteGuard from './components/mobile/MobileRouteGuard';
import DashboardPage from './pages/DashboardPage';
import MobileDashboardPage from './pages/mobile/MobileDashboardPage';
import MobileAssetsPage from './pages/mobile/MobileAssetsPage';
import MobileRatiosPage from './pages/mobile/MobileRatiosPage';
import BenchmarkPage from './pages/BenchmarkPage';
import MarketAnalysisPage from './pages/MarketAnalysisPage';
import StockAnalysisPage from './pages/StockAnalysisPage';
import AssetAllocationSimulationPage from './pages/AssetAllocationSimulationPage';
import CompoundInterestPage from './pages/CompoundInterestPage';
import SectorPage from './pages/SectorPage';
import ConnectionPage from './pages/ConnectionPage';
import DbManagementPage from './pages/DbManagementPage';
import RatioCheckPage from './pages/RatioCheckPage';
import SnapshotWizardPage from './pages/SnapshotWizardPage';
import WatchlistSectorPage from './pages/WatchlistSectorPage';
import DividendAnalysisPage from './pages/DividendAnalysisPage';
import PerformanceAnalysisPage from './pages/PerformanceAnalysisPage';
import DbExplorerPage from './pages/DbExplorerPage';
import SystemLogPage from './pages/SystemLogPage';
import TitleManager from './components/TitleManager';

/**
 * 모바일 환경 라우트 구성
 */
function MobileAppRoutes() {
  return (
    <MobileRouteGuard>
      <MobileLayout>
        <Routes>
          <Route path="/" element={<MobileDashboardPage />} />
          <Route path="/dashboard" element={<MobileDashboardPage />} />
          <Route path="/m/dashboard" element={<MobileDashboardPage />} />
          <Route path="/m/assets" element={<MobileAssetsPage />} />
          <Route path="/m/ratios" element={<MobileRatiosPage />} />
          <Route path="/m/settings" element={<MobileDashboardPage />} />
          {/* 비허용 데스크톱 경로는 MobileRouteGuard에서 자동으로 / 로 리다이렉트됨 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileLayout>
    </MobileRouteGuard>
  );
}

/**
 * 데스크톱 환경 라우트 구성
 */
function DesktopAppRoutes() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/benchmark/compare-returns" element={<SectorPage />} />
          <Route path="/market/analysis" element={<MarketAnalysisPage />} />
          <Route path="/market/stock-analysis" element={<StockAnalysisPage />} />
          <Route path="/ratios/check" element={<RatioCheckPage />} />
          <Route path="/dividend" element={<DividendAnalysisPage />} />
          <Route path="/performance" element={<PerformanceAnalysisPage />} />
          <Route path="/simulation/asset-allocation" element={<AssetAllocationSimulationPage />} />
          <Route path="/simulation/compound-interest" element={<CompoundInterestPage />} />
          <Route path="/connection" element={<ConnectionPage />} />
          <Route path="/db" element={<DbManagementPage />} />
          <Route path="/db/snapshots/new" element={<SnapshotWizardPage />} />
          <Route path="/db/watchlist-sector" element={<WatchlistSectorPage />} />
          <Route path="/system/db-explorer" element={<DbExplorerPage />} />
          <Route path="/system/logs" element={<SystemLogPage />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  const isMobile = useIsMobile();

  return (
    <Router>
      <TitleManager />
      <MaskingProvider>
        {isMobile ? <MobileAppRoutes /> : <DesktopAppRoutes />}
      </MaskingProvider>
    </Router>
  );
}

export default App;
