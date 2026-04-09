import { formatPrice } from '../utils/textUtils';

function CartDrawer({
  open,
  onClose,
  cartItems,
  tableNo,
  orderNote,
  onOrderNoteChange,
  onIncrease,
  onDecrease,
  onRemove,
  onItemNoteChange,
  total,
  onCheckout,
  isSubmitting,
  checkoutError,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="absolute bottom-0 left-0 right-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-cyan-300/25 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:bottom-6 md:left-auto md:right-6 md:top-6 md:w-[440px] md:rounded-3xl md:border md:p-5 md:pb-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Masa {tableNo}</p>
            <h2 className="text-xl font-bold text-white">Sipariş Sepeti</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-cyan-300/60"
          >
            Kapat
          </button>
        </div>

        <div className="mb-4 max-h-[min(42vh,22rem)] space-y-3 overflow-y-auto pr-1 md:max-h-[52vh]">
          {cartItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">
              Sepetiniz boş.
            </div>
          ) : (
            cartItems.map((line) => (
              <div key={line.lineId} className="rounded-xl border border-slate-800 bg-slate-950/90 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{line.productName}</p>
                    <p className="text-xs text-slate-400">{formatPrice(line.price)} / adet</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(line.lineId)}
                    className="text-xs text-rose-300 transition hover:text-rose-200"
                  >
                    Sil
                  </button>
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDecrease(line.lineId, line.quantity - 1)}
                    className="h-8 w-8 rounded-lg border border-slate-700 text-sm text-slate-200"
                  >
                    -
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold text-white">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onIncrease(line.lineId, line.quantity + 1)}
                    className="h-8 w-8 rounded-lg border border-slate-700 text-sm text-slate-200"
                  >
                    +
                  </button>
                </div>

                <label className="block text-xs text-slate-400">
                  Ürün notu
                  <input
                    type="text"
                    value={line.specialNote}
                    onChange={(event) => onItemNoteChange(line.lineId, event.target.value)}
                    placeholder="Örn: soğansız"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70"
                  />
                </label>
              </div>
            ))
          )}
        </div>

        <label className="mb-3 block text-xs text-slate-400">
          Sipariş notu (opsiyonel)
          <textarea
            value={orderNote}
            onChange={(event) => onOrderNoteChange(event.target.value)}
            rows={2}
            placeholder="Servis için genel not"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70"
          />
        </label>

        {checkoutError ? (
          <p className="mb-3 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {checkoutError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-400">Toplam</p>
            <p className="text-lg font-bold text-emerald-300">{formatPrice(total)}</p>
          </div>
          <button
            type="button"
            disabled={!cartItems.length || isSubmitting}
            onClick={onCheckout}
            className={`w-full rounded-xl px-5 py-3 text-sm font-bold transition sm:w-auto ${
              !cartItems.length || isSubmitting
                ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
            }`}
          >
            {isSubmitting ? 'Gönderiliyor...' : 'Siparişi gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CartDrawer;
