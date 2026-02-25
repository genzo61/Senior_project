import React from 'react';

const OrderCard = ({ order, onFinish }) => {
  const timeStr = new Date(order.orderTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="relative p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden group transition-all hover:scale-[1.02] hover:bg-white/15">
      {/* Decorative dot */}
      <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
      
      <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
            Masa {order.tableNo}
          </h2>
          <span className="text-xs text-slate-300 bg-black/20 px-2 py-1 rounded-md mt-2 inline-block">
            Sipariş No: #{order.id} | {timeStr}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
            <span className="font-semibold text-lg">{item.productName}</span>
            <span className="bg-indigo-500/80 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold shadow-lg">
              {item.quantity}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onFinish(order.id)}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <span>✅</span> Siparişi Hazırla
      </button>
    </div>
  );
};

export default OrderCard;
