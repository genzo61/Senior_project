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
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <p className="text-xs uppercase tracking-wider text-emerald-300">Siparis alindi</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Siparis #{orderId}</h1>
        <p className="mt-2 text-sm text-slate-300">Masa: {tableId}</p>

        {loading ? <p className="mt-4 text-sm text-slate-400">Durum yukleniyor...</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        {order ? (
          <>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-400">Durum</p>
              <p className="text-sm font-semibold text-amber-300">{STATUS_LABELS[order.status] ?? order.status}</p>
            </div>

            <div className="mt-4 space-y-2">
              {(order.items ?? []).map((item, index) => (
                <div key={`item-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-sm font-semibold text-white">{item.productName}</p>
                  <p className="text-xs text-slate-400">{item.quantity} adet</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
              <p className="text-sm text-slate-300">Toplam</p>
              <p className="text-lg font-bold text-emerald-300">{formatPrice(total)}</p>
            </div>
          </>
        ) : null}

        <Link
          to={`/menu?table=${tableId}`}
          className="mt-5 inline-flex rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Yeni siparis ver
        </Link>
      </div>
    </main>
  );
}

export default OrderStatusPage;
