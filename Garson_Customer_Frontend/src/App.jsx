import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CustomerTableView from './CustomerTableView';

function App() {
  return (
    <Router>
      <div className="w-full min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans selection:bg-indigo-500/30">
        <Routes>
          <Route path="/masa/:id" element={<CustomerTableView />} />
          <Route path="*" element={
            <div className="text-center p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl">
              <h1 className="text-3xl font-bold mb-4 text-indigo-400">Garson Robot Servisi</h1>
              <p className="text-slate-400 text-lg">Lütfen masanızdaki QR kodu okutunuz.</p>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
