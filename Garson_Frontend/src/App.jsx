import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import OrdersDashboard from "./components/OrdersDashboard";
import StockDashboard from "./components/StockDashboard";
import ManagerTablesDashboard from "./components/ManagerTablesDashboard";
import CashRegisterDashboard from "./components/CashRegisterDashboard";

const navLinkClass = ({ isActive }) =>
  `shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-all sm:px-4 ${
    isActive
      ? "border border-cyan-300/60 bg-cyan-400/20 text-cyan-100 shadow-[0_0_20px_rgba(103,232,249,0.2)]"
      : "border border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/70 hover:text-white"
  }`;

function App() {
  return (
    <Router>
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(165deg,#020617,#0b1120_58%,#020617)] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#020617,#0f172a_58%,#020617)]" />
        <div className="aurora-orb aurora-orb--1" />
        <div className="aurora-orb aurora-orb--2" />
        <div className="aurora-orb aurora-orb--3" />
        <div className="robot-grid-overlay" />

        <nav className="relative z-50 mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 pb-2 pt-3 sm:px-6 sm:pt-4 lg:px-8">
          <div className="w-full rounded-2xl border border-cyan-200/30 bg-slate-900/80 px-4 py-2 backdrop-blur sm:w-auto">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Robot Kafe</p>
            <p className="text-sm font-bold text-slate-100">Mutfak Paneli</p>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70 p-2 backdrop-blur">
            <div className="flex min-w-max items-center gap-2">
              <NavLink to="/" end className={navLinkClass}>
                Siparisler
              </NavLink>
              <NavLink to="/tables" className={navLinkClass}>
                Masalar
              </NavLink>
              <NavLink to="/stock" className={navLinkClass}>
                Stok
              </NavLink>
              <NavLink to="/cashier" className={navLinkClass}>
                Kasa
              </NavLink>
            </div>
          </div>
        </nav>

        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<OrdersDashboard />} />
            <Route path="/tables" element={<ManagerTablesDashboard />} />
            <Route path="/stock" element={<StockDashboard />} />
            <Route path="/cashier" element={<CashRegisterDashboard />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
