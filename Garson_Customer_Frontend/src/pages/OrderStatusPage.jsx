import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { fetchOrderById } from '../services/customerApi';
import { getCartTotal } from '../utils/cartUtils';
import { formatPrice } from '../utils/textUtils';
import { parseTableFromSearchParams } from '../utils/tableContext';

const STATUS_LABELS = {
  NEW: 'Mutfakta hazirlaniyor',
  READY: 'Servise hazir',
  DELIVERED: 'Teslim edildi',
  PAID: 'Odeme tamamlandi',
};

function OrderStatusPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const [searchParams] = useState(() => new URLSearchParams(location.search));
  const tableId = parseTableFromSearchParams(searchParams) ?? location.state?.tableId ?? '-';

  const [order, setOrder] = useState(location.state?.order ?? null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      try {
        const response = await fetchOrderById(orderId);
        if (isMounted) {
          setOrder(response);
          setError('');
        }
      } catch {
        if (isMounted) {
          setError('Siparis bilgisi alinamadi.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOrder();
    const timer = setInterval(loadOrder, 8000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [orderId]);

  const total = useMemo(() => {
    if (!order?.items) {
      return 0;
    }
    return getCartTotal(
      order.items.map((item, index) => ({
        lineId: `order-${index}`,
        productId: index,
        productName: item.productName,
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        specialNote: '',
      })),
    );
  }, [order]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <div className="rounded-[2rem] border border-cyan-200/25 bg-slate-900/85 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.65)] backdrop-blur sm:p-7">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Siparis alindi</p>
        <h1 className="mt-1 text-3xl font-black text-white">Siparis #{orderId}</h1>
        <p className="mt-2 text-sm text-slate-300">Masa: {tableId}</p>

        {loading ? <p className="mt-4 text-sm text-slate-400">Durum yukleniyor...</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {order ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              <p className="text-xs text-slate-400">Durum</p>
              <p className="text-sm font-semibold text-cyan-200">{STATUS_LABELS[order.status] ?? order.status}</p>
              <div className="mt-4 border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-400">Toplam</p>
                <p className="text-2xl font-black text-emerald-300">{formatPrice(total)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {(order.items ?? []).map((item, index) => (
                <div key={`item-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
                  <p className="text-sm font-semibold text-white">{item.productName}</p>
                  <p className="text-xs text-slate-400">{item.quantity} adet</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Link
          to={`/menu?table=${tableId}`}
          className="mt-6 inline-flex rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950"
        >
          Yeni siparis ver
        </Link>
      </div>
    </main>
  );
}

export default OrderStatusPage;
