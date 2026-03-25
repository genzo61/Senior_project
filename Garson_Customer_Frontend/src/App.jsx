import { BrowserRouter as Router, Navigate, Route, Routes, useParams } from 'react-router-dom';
import AccessHelpPage from './pages/AccessHelpPage';
import MenuPage from './pages/MenuPage';
import OrderStatusPage from './pages/OrderStatusPage';
import QrEntryPage from './pages/QrEntryPage';

function LegacyTableRedirect() {
  const { id } = useParams();
  return <Navigate to={`/menu?table=${encodeURIComponent(id ?? '')}`} replace />;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[linear-gradient(165deg,#020617,#0b1120_52%,#020617)] text-slate-100">
        <Routes>
          <Route path="/" element={<Navigate to="/menu?table=1" replace />} />
          <Route path="/q/:token" element={<QrEntryPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/order/:orderId" element={<OrderStatusPage />} />
          <Route path="/masa/:id" element={<LegacyTableRedirect />} />
          <Route path="/help" element={<AccessHelpPage />} />
          <Route path="*" element={<Navigate to="/menu?table=1" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
