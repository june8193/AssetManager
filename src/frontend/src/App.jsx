import React from 'react';
import './index.css';

function App() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row">
      {/* SideNavBar (Desktop) */}
      <nav className="hidden md:flex flex-col gap-2 p-6 h-screen w-64 fixed left-0 top-0 z-40 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-2xl">
        <div className="mb-8">
          <h1 className="font-['Manrope'] font-extrabold text-blue-900 dark:text-blue-50 text-2xl tracking-tight">AssetManager</h1>
          <p className="font-['Inter'] text-[13px] font-medium text-slate-500">The Architect's Ledger</p>
        </div>
        <div className="flex flex-col gap-2 flex-grow">
          {/* Active Tab: Dashboard */}
          <a className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 text-blue-900 dark:text-blue-100 rounded-xl shadow-sm font-['Inter'] text-[13px] font-medium cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-['Inter'] text-[13px] font-medium hover:translate-x-1 transition-all duration-300 cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined">account_balance</span>
            <span>Assets</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-['Inter'] text-[13px] font-medium hover:translate-x-1 transition-all duration-300 cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined">swap_horiz</span>
            <span>Transactions</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-['Inter'] text-[13px] font-medium hover:translate-x-1 transition-all duration-300 cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined">payments</span>
            <span>Dividends</span>
          </a>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <button className="w-full py-3 px-4 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-['Inter'] text-[13px] font-medium hover:opacity-90 transition-opacity mb-4">
            Upgrade to Pro
          </button>
          <a className="flex items-center gap-3 px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-['Inter'] text-[13px] font-medium hover:translate-x-1 transition-all duration-300 cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-['Inter'] text-[13px] font-medium hover:translate-x-1 transition-all duration-300 cursor-pointer active:scale-98" href="#">
            <span className="material-symbols-outlined">help_outline</span>
            <span>Support</span>
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col w-full">
        {/* TopNavBar (Mobile Only) */}
        <header className="md:hidden flex justify-between items-center px-6 py-4 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 bg-slate-100 dark:bg-slate-800 shadow-[0_20px_40px_-15px_rgba(25,28,30,0.04)]">
          <div className="text-2xl font-black tracking-tighter text-blue-900 dark:text-blue-50 font-headline">AssetManager</div>
          <div className="flex items-center gap-4 text-blue-900 dark:text-blue-400">
            <span className="material-symbols-outlined cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 active:scale-95 transition-transform">notifications</span>
            <span className="material-symbols-outlined cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 active:scale-95 transition-transform">settings</span>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
            <div>
              <h2 className="text-[1.75rem] font-headline font-semibold tracking-[-0.02em] text-on-surface mb-2">Total Net Worth</h2>
              <div className="flex items-baseline gap-4">
                <span className="text-[3.5rem] font-headline font-bold text-on-background leading-none">$1,245,678.90</span>
                <div className="flex items-center gap-1 bg-surface-container-low px-3 py-1.5 rounded-full">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                  <span className="text-tertiary-fixed-dim font-medium text-sm">+12.4% All Time</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="px-6 py-2.5 rounded-full bg-transparent border border-outline/20 text-primary font-medium text-sm hover:bg-surface-container-low transition-colors">
                Add Asset
              </button>
              <button className="px-6 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-medium text-sm shadow-[0_20px_40px_-15px_rgba(0,50,138,0.4)] hover:opacity-90 transition-opacity">
                Generate Report
              </button>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
            {/* Main Trend Chart */}
            <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_-15px_rgba(25,28,30,0.04)] border border-outline-variant/15 flex flex-col h-96 relative overflow-hidden group">
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-base font-medium font-body text-on-surface">Portfolio Growth</h3>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low rounded-md transition-colors">1W</button>
                  <button className="px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low rounded-md transition-colors">1M</button>
                  <button className="px-3 py-1 text-xs font-medium text-on-primary bg-primary rounded-md shadow-sm">1Y</button>
                  <button className="px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low rounded-md transition-colors">ALL</button>
                </div>
              </div>
              {/* Decorative Chart Sparkline */}
              <div className="absolute bottom-0 left-0 right-0 h-4/5 w-full bg-gradient-to-t from-primary/5 to-transparent z-0 opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
              <svg className="absolute bottom-0 left-0 w-full h-3/4 z-10 preserve-3d" preserveAspectRatio="none" viewBox="0 0 1000 300">
                <path d="M0,300 L0,200 C100,180 200,250 300,220 C400,190 500,150 600,160 C700,170 800,100 900,120 L1000,80 L1000,300 Z" fill="url(#chart-gradient)" opacity="0.2" />
                <path className="text-primary" d="M0,200 C100,180 200,250 300,220 C400,190 500,150 600,160 C700,170 800,100 900,120 L1000,80" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                <defs>
                  <linearGradient id="chart-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop className="text-primary" offset="0%" stopColor="currentColor" stopOpacity="1" />
                    <stop className="text-primary" offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle className="text-primary" cx="300" cy="220" fill="currentColor" r="4" stroke="currentColor" strokeWidth="2" />
                <circle className="text-primary" cx="600" cy="160" fill="currentColor" r="4" stroke="currentColor" strokeWidth="2" />
                <circle className="text-surface-container-lowest" cx="1000" cy="80" fill="currentColor" r="6" stroke="currentColor" strokeWidth="3" />
              </svg>
              <div className="absolute right-6 top-20 z-20 bg-surface-container-lowest/90 backdrop-blur-sm p-3 rounded-lg border border-outline-variant/20 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-on-surface-variant font-medium">Nov 15, 2023</p>
                <p className="text-sm font-bold text-on-surface">$1,245,678.90</p>
              </div>
            </div>

            {/* Asset Allocation Donut */}
            <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_-15px_rgba(25,28,30,0.04)] border border-outline-variant/15 flex flex-col">
              <h3 className="text-base font-medium font-body text-on-surface mb-6">Asset Allocation</h3>
              <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Abstract Donut representation */}
                <div className="w-40 h-40 rounded-full border-[16px] border-surface-container-low relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[16px] border-primary" style={{ clipPath: "polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 50%)" }}></div>
                  <div className="absolute inset-0 rounded-full border-[16px] border-tertiary-container" style={{ clipPath: "polygon(50% 50%, 0 50%, 0 0, 50% 0)", transform: "rotate(-45deg)" }}></div>
                  <div className="absolute inset-0 rounded-full border-[16px] border-secondary-container" style={{ clipPath: "polygon(50% 50%, 50% 0, 100% 0)", transform: "rotate(-90deg)" }}></div>
                  <div className="text-center">
                    <span className="block text-2xl font-bold font-headline text-on-surface">5</span>
                    <span className="block text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">Assets</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary"></span>
                    <span className="font-medium text-on-surface-variant">Stocks</span>
                  </div>
                  <span className="font-bold text-on-surface">65%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-tertiary-container"></span>
                    <span className="font-medium text-on-surface-variant">Real Estate</span>
                  </div>
                  <span className="font-bold text-on-surface">20%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-secondary-container"></span>
                    <span className="font-medium text-on-surface-variant">Crypto</span>
                  </div>
                  <span className="font-bold text-on-surface">15%</span>
                </div>
              </div>
            </div>

            {/* Portfolio Performance Summary */}
            <div className="md:col-span-12 bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_-15px_rgba(25,28,30,0.04)] border border-outline-variant/15">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-medium font-body text-on-surface">Portfolio Performance</h3>
                <a className="text-sm font-medium text-primary hover:text-primary-container transition-colors flex items-center gap-1" href="#">
                  View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </a>
              </div>
              <div className="flex flex-col">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-4 pb-4 border-b border-outline-variant/15 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  <div className="col-span-5 md:col-span-4">Portfolio Name</div>
                  <div className="col-span-4 md:col-span-3 text-right">Value</div>
                  <div className="col-span-3 md:col-span-2 text-right">24h Change</div>
                  <div className="hidden md:block col-span-3 text-right">Trend (7d)</div>
                </div>
                
                {/* Item 1 */}
                <div className="grid grid-cols-12 gap-4 py-4 border-b border-outline-variant/5 items-center hover:bg-surface-container-low/50 transition-colors -mx-4 px-4 rounded-lg cursor-pointer">
                  <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">work</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-on-surface">Tech Growth Fund</p>
                      <p className="text-xs text-on-surface-variant">Fidelity</p>
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-3 text-right font-medium text-sm text-on-surface">
                    $452,100.00
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    <span className="inline-flex items-center gap-1 text-tertiary-fixed-dim bg-tertiary-fixed-dim/10 px-2 py-1 rounded text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]">arrow_upward</span> 2.4%
                    </span>
                  </div>
                  <div className="hidden md:block col-span-3 h-8 relative">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
                      <path className="text-tertiary-fixed-dim" d="M0,25 L20,15 L40,20 L60,10 L80,15 L100,5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="grid grid-cols-12 gap-4 py-4 border-b border-outline-variant/5 items-center hover:bg-surface-container-low/50 transition-colors -mx-4 px-4 rounded-lg cursor-pointer">
                  <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">real_estate_agent</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-on-surface">Commercial RE Trust</p>
                      <p className="text-xs text-on-surface-variant">Vanguard</p>
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-3 text-right font-medium text-sm text-on-surface">
                    $250,000.00
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    <span className="inline-flex items-center gap-1 text-on-surface-variant bg-surface-container-high px-2 py-1 rounded text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]">horizontal_rule</span> 0.0%
                    </span>
                  </div>
                  <div className="hidden md:block col-span-3 h-8 relative">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
                      <path className="text-outline" d="M0,15 L20,16 L40,14 L60,15 L80,16 L100,15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="grid grid-cols-12 gap-4 py-4 items-center hover:bg-surface-container-low/50 transition-colors -mx-4 px-4 rounded-lg cursor-pointer">
                  <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error">
                      <span className="material-symbols-outlined">currency_bitcoin</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-on-surface">Crypto Holdings</p>
                      <p className="text-xs text-on-surface-variant">Cold Storage</p>
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-3 text-right font-medium text-sm text-on-surface">
                    $186,845.50
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    <span className="inline-flex items-center gap-1 text-error bg-error/10 px-2 py-1 rounded text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]">arrow_downward</span> 5.1%
                    </span>
                  </div>
                  <div className="hidden md:block col-span-3 h-8 relative">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
                      <path className="text-error" d="M0,5 L20,15 L40,10 L60,20 L80,15 L100,25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg pb-safe border-t border-slate-200 dark:border-slate-800 z-50 shadow-[0_-10px_40px_-15px_rgba(25,28,30,0.05)]">
        <div className="flex justify-around items-center px-2 py-3">
          <a className="flex flex-col items-center gap-1 text-blue-900 dark:text-blue-400 font-bold w-16" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            <span className="text-[10px] font-medium">Dashboard</span>
          </a>
          <a className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors w-16" href="#">
            <span className="material-symbols-outlined">account_balance</span>
            <span className="text-[10px] font-medium">Assets</span>
          </a>
          <a className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors w-16" href="#">
            <span className="material-symbols-outlined">swap_horiz</span>
            <span className="text-[10px] font-medium">Transact</span>
          </a>
          <a className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors w-16" href="#">
            <span className="material-symbols-outlined">payments</span>
            <span className="text-[10px] font-medium">Dividends</span>
          </a>
        </div>
      </nav>
    </div>
  );
}

export default App;
