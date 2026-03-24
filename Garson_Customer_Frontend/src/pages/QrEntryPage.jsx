import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchTableById } from '../services/customerApi';
import { parseTableToken, saveTableContext } from '../utils/tableContext';

function QrEntryPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function resolveToken() {
      const tableId = parseTableToken(token);

      if (!tableId) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('QR kodu cozumlenemedi. Lutfen personelden yardim isteyin.');
        }
        return;
      }

      try {
        const table = await fetchTableById(tableId);

        if (!table) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(`Masa ${tableId} sistemde bulunamadi.`);
          }
          return;
        }

        saveTableContext({ tableId, source: 'qr_token' });

        if (isMounted) {
          setStatus('success');
          navigate(`/menu?table=${tableId}`, { replace: true });
        }
      } catch {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Sunucuya baglanirken hata olustu. Lutfen tekrar deneyin.');
        }
      }
    }

    resolveToken();

    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <div className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
        {status === 'loading' ? (
          <>
            <p className="text-xs uppercase tracking-wider text-slate-400">QR kontrol</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Masa bilgisi dogrulaniyor</h1>
            <p className="mt-2 text-sm text-slate-300">Lutfen bekleyin...</p>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <p className="text-xs uppercase tracking-wider text-rose-300">Erisim hatasi</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Gecersiz QR kod</h1>
            <p className="mt-2 text-sm text-slate-300">{errorMessage}</p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Ana yardim ekranina don
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default QrEntryPage;
