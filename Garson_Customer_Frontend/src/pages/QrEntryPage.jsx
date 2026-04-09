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
      const tableNo = parseTableToken(token);

      if (!tableNo) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('QR kodu çözümlenemedi. Lütfen personelden yardım isteyin.');
        }
        return;
      }

      try {
        const table = await fetchTableById(tableNo);

        if (!table) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(`Masa ${tableNo} sistemde bulunamadı.`);
          }
          return;
        }

        saveTableContext({ tableNo, source: 'qr_token' });

        if (isMounted) {
          setStatus('success');
          navigate(`/menu?tableNo=${tableNo}`, { replace: true });
        }
      } catch {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Sunucuya bağlanırken hata oluştu. Lütfen tekrar deneyin.');
        }
      }
    }

    resolveToken();

    return () => {
      isMounted = false;
    };
  }, [navigate, token]);

  return (
    <main className="safe-screen-min mx-auto flex w-full max-w-4xl items-center px-4 py-8 sm:px-5 sm:py-10">
      <div className="w-full rounded-3xl border border-cyan-200/25 bg-slate-900/85 p-6 text-center shadow-[0_24px_70px_rgba(2,6,23,0.65)] backdrop-blur sm:p-8">
        {status === 'loading' ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">QR kontrol</p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Masa bilgisi doğrulanıyor</h1>
            <p className="mt-2 text-sm text-slate-300">Lütfen bekleyin...</p>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-300">Erişim hatası</p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Geçersiz QR kod</h1>
            <p className="mt-2 text-sm text-slate-300">{errorMessage}</p>
            <Link
              to="/"
              className="mt-5 inline-flex w-full justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 sm:w-auto"
            >
              Ana yardım ekranına dön
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default QrEntryPage;
