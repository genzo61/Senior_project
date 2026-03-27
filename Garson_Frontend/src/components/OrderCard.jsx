import React from "react";

const statusBadgeClass = {
  NEW: "border-rose-400/50 bg-rose-500/20 text-rose-100",
  READY: "border-amber-400/50 bg-amber-500/20 text-amber-100",
  DELIVERED: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
  PAID: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
};

const actionButtonClass = {
  READY:
    "border border-emerald-300/60 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30",
  DELIVERED:
    "border border-cyan-300/60 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30",
};

const OrderCard = ({ order, onStatusChange, nextStatus, isLoading }) => {
  const timeStr = order.orderTime
    ? new Date(order.orderTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : order.createdAt
      ? new Date(order.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "??:??";

  const buttonClass = nextStatus ? actionButtonClass[nextStatus] : "";
  const statusClass = statusBadgeClass[order.status] || "border-slate-600 bg-slate-700/40 text-slate-200";

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-[0_16px_48px_rgba(2,6,23,0.55)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 sm:p-5 ${
        isLoading ? "opacity-70" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/0 via-cyan-300/70 to-cyan-400/0" />

      <header className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">Masa {order.tableNo || "?"}</p>
          <h3 className="mt-1 text-lg font-black text-slate-100 sm:text-xl">Siparis #{order.id}</h3>
          <p className="mt-1 text-xs text-slate-400">Saat {timeStr}</p>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusClass}`}>
          {order.status}
        </span>
      </header>

      <div className="space-y-2.5">
        {order.items?.map((item, idx) => (
          <div
            key={item.id || idx}
            className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-2"
          >
            <div className="min-w-0 pr-3">
              <p className="truncate text-sm font-semibold text-slate-100">{item.productName || item.name}</p>
              {item.specialNote ? <p className="truncate text-xs text-amber-200">Not: {item.specialNote}</p> : null}
            </div>
            <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2.5 py-1 text-xs font-bold text-cyan-100">
              {item.quantity || item.qty}x
            </span>
          </div>
        ))}
      </div>

      {order.notes ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {order.notes}
        </div>
      ) : null}

      {nextStatus ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onStatusChange(order.id, nextStatus)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            isLoading ? "cursor-not-allowed border border-slate-600 bg-slate-700/60 text-slate-300" : buttonClass
          }`}
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Isleniyor...
            </>
          ) : nextStatus === "READY" ? (
            "Siparisi Hazirla"
          ) : (
            "Teslim Edildi Olarak Isle"
          )}
        </button>
      ) : null}
    </article>
  );
};

export default OrderCard;
