import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import OrdersDashboard from "./components/OrdersDashboard";
import StockDashboard from "./components/StockDashboard";
import ManagerTablesDashboard from "./components/ManagerTablesDashboard";
import CashRegisterDashboard from "./components/CashRegisterDashboard";

function App() {
  return (
    <Router>
      <div className="w-full min-h-screen text-white relative overflow-hidden bg-slate-900">
        {/* Navigation Bar */}
        <nav className="relative z-50 bg-slate-800/80 backdrop-blur-md border-b border-white/10 p-4 shadow-lg flex justify-center space-x-8">
          <Link
            to="/"
            className="text-lg font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 px-6 py-2 rounded-xl transition-all"
          >
            🍳 Aktif Siparişler
          </Link>
          <Link
            to="/tables"
            className="text-lg font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 px-6 py-2 rounded-xl transition-all"
          >
            🍽️ Masalar
          </Link>
          <Link
            to="/stock"
            className="text-lg font-bold text-slate-300 hover:text-white hover:bg-slate-700/50 px-6 py-2 rounded-xl transition-all"
          >
            📦 Stok Paneli
          </Link>
          <Link
            to="/cashier"
            className="text-lg font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
          >
            💰 Kasa
          </Link>
        </nav>

        {/* Dynamic Content */}
        <Routes>
          <Route path="/" element={<OrdersDashboard />} />
          <Route path="/tables" element={<ManagerTablesDashboard />} />
          <Route path="/stock" element={<StockDashboard />} />
          <Route path="/cashier" element={<CashRegisterDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
