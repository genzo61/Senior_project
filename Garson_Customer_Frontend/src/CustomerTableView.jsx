import { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Bot, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const CustomerTableView = () => {
  const { id } = useParams();
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const callRobot = async () => {
    setStatus('loading');
    setErrorMessage('');
    
    try {
      // Assuming backend is running on localhost:8080. In production, this should be configurable via env vars.
      await axios.post(`http://localhost:8080/api/tables/${id}/cagir`);
      setStatus('success');
    } catch (error) {
      console.error("Error calling robot:", error);
      setStatus('error');
      setErrorMessage(
        error.response?.data || 
        "Robot şu anda meşgul veya ulaşılamıyor. Lütfen bir personelden yardım isteyin."
      );
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-6 flex flex-col items-center justify-center min-h-[80vh]">
      
      {/* Header Info */}
      <div className="mb-12 text-center transform transition-all hover:scale-105 duration-300">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/20 text-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)] border border-indigo-500/30">
          <Bot size={40} className={status === 'success' ? 'animate-bounce' : ''} />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Masa {id}
        </h1>
        <p className="text-slate-400 font-medium tracking-wide">Dijital Garson Servisi</p>
      </div>

      {/* Main Action Area */}
      <div className="w-full relative group">
        
        {/* Decorative Glow */}
        <div className={`absolute -inset-1 bg-gradient-to-r rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 
          ${status === 'success' ? 'from-green-400 to-emerald-600 opacity-50' : 
            status === 'error' ? 'from-red-400 to-rose-600' : 
            'from-indigo-500 to-purple-600'}`}>
        </div>
        
        <button
          onClick={callRobot}
          disabled={status === 'loading' || status === 'success'}
          className={`relative w-full py-6 px-8 rounded-2xl font-bold text-xl flexflex-col items-center justify-center gap-3 transition-all duration-300 shadow-2xl overflow-hidden
            ${status === 'idle' 
              ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10 hover:border-indigo-500/50' 
              : status === 'loading'
                ? 'bg-indigo-600/50 text-indigo-100 cursor-wait border border-indigo-500/50'
                : status === 'success'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed'
                  : 'bg-rose-900/40 text-rose-200 border border-rose-500/50 hover:bg-rose-900/60'
            }`}
        >
          {/* Button Content based on state */}
          <div className="flex flex-col items-center justify-center w-full min-h-[4rem] gap-2">
            {status === 'idle' && (
              <>
                <Bot size={32} className="mb-1 text-indigo-400 group-hover:text-indigo-300" />
                <span className="tracking-wide">Robotu Çağır</span>
              </>
            )}
            
            {status === 'loading' && (
              <>
                <Loader2 size={32} className="animate-spin mb-1" />
                <span className="animate-pulse tracking-wide">Bağlanıyor...</span>
              </>
            )}
            
            {status === 'success' && (
              <>
                <CheckCircle2 size={32} className="mb-1" />
                <span className="tracking-wide">Robot Yolda!</span>
                <span className="text-sm font-normal text-emerald-500/70 mt-1">Lütfen bekleyiniz...</span>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle size={32} className="mb-1 text-rose-400" />
                <span className="tracking-wide">Tekrar Dene</span>
              </>
            )}
          </div>
          
          {/* Progress Bar (Decorative) */}
          {(status === 'loading' || status === 'success') && (
            <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r transition-all duration-1000 ease-out 
              ${status === 'success' ? 'w-full from-emerald-400 to-green-500' : 'w-2/3 from-indigo-400 to-purple-500 animate-pulse'}`} 
            />
          )}
        </button>
      </div>

      {/* Error Message Display */}
      {status === 'error' && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
          {errorMessage}
        </div>
      )}

    </div>
  );
};

export default CustomerTableView;
