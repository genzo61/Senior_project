import React from "react";

const OrderCard = ({ order, onStatusChange, nextStatus, isLoading }) => {
  const timeStr = order.createdAt
    ? new Date(order.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "??:??";

  return (
    <div className={`relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden group transition-all hover:scale-[1.01] hover:bg-white/15 z-20 ${isLoading ? 'opacity-70 grayscale-[0.3]' : ''}`}>
      {/* Status indicator */}
      <div
        className={`absolute top-4 right-4 w-3 h-3 rounded-full animate-pulse shadow-lg ${
          order.status === "NEW"
            ? "bg-red-500 shadow-red-500/50"
            : order.status === "READY"
              ? "bg-amber-500 shadow-amber-500/50"
              : "bg-emerald-500 shadow-emerald-500/50"
        }`}
      />

      <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
            Masa {order.tableId || "?"}
          </h2>
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-xs text-slate-300 bg-black/20 px-2 py-1 rounded-md inline-block">
              Sipariş No: #{order.id} | {timeStr}
            </span>
            {order.language && (
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Dil: {order.language}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
        {order.items?.map((item, idx) => (
          <div
            key={item.id || idx}
            className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5"
          >
            <span className="font-semibold text-lg text-slate-100">
              {item.name}
            </span>
            <span className="bg-indigo-500/80 text-white min-w-[32px] h-8 px-2 flex items-center justify-center rounded-full font-bold shadow-lg">
              {item.qty}x
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mb-6 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-200 italic">
          "{order.notes}"
        </div>
      )}

      {nextStatus && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onStatusChange(order.id, nextStatus)}
          className={`relative z-30 w-full py-3 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
            isLoading ? "cursor-not-allowed bg-slate-600 opacity-50" : "cursor-pointer"
          } ${
            nextStatus === "READY"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
              : "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400"
          }`}
        >
          {isLoading ? (
             <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>İşleniyor...</span>
             </div>
          ) : (
            <>
              <span>{nextStatus === "READY" ? "✅" : "🚚"}</span>
              {nextStatus === "READY" ? "Siparişi Hazırla" : "Teslim Et"}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default OrderCard;
