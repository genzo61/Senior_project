import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { backendBaseUrl, backendWsUrl } from "../config/backendUrl";

function StockDashboard() {
  const [products, setProducts] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();

    // Keep stock list in sync with websocket updates.
    const client = new Client({
      webSocketFactory: () => new SockJS(backendWsUrl),
      onConnect: () => {
        client.subscribe("/topic/products", (message) => {
          if (!message.body) return;
          const updatedProducts = JSON.parse(message.body);
          setProducts(updatedProducts);
        });
      },
    });
    client.activate();

    return () => {
      client.deactivate();
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${backendBaseUrl}/api/products`);
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Urunler cekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = (id, currentStock) => {
    const change = pendingChanges[id] !== undefined ? pendingChanges[id] : currentStock;
    setPendingChanges((prev) => ({ ...prev, [id]: change + 1 }));
  };

  const handleDecrement = (id, currentStock) => {
    const change = pendingChanges[id] !== undefined ? pendingChanges[id] : currentStock;
    if (change <= 0) return;
    setPendingChanges((prev) => ({ ...prev, [id]: change - 1 }));
  };

  const confirmStockUpdate = async (id) => {
    if (pendingChanges[id] === undefined) return;
    const newStock = pendingChanges[id];

    try {
      const res = await fetch(`${backendBaseUrl}/api/products/${id}/stock?quantity=${newStock}`, {
        method: "PUT",
      });
      if (!res.ok) return;

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, stock: newStock } : product)));
    } catch (err) {
      console.error("Stok guncellenemedi:", err);
    }
  };

  if (loading) {
    return <div className="mt-16 px-4 text-center text-lg text-white sm:mt-20 sm:text-xl">Yukleniyor...</div>;
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden p-3 text-white sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-green-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[40%] w-[40%] rounded-full bg-teal-500/20 blur-[120px]" />

      <header className="relative z-10 mb-6 flex flex-col items-center text-center sm:mb-10">
        <h1 className="mb-2 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent drop-shadow-sm sm:text-4xl">
          Stok ve Menu Yonetimi
        </h1>
        <p className="mb-2 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          Mutfaktaki anlik stok durumlarini buradan takip edip bittikce guncelleyebilirsiniz.
        </p>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 shadow-2xl backdrop-blur-xl">
          <div className="hidden grid-cols-4 gap-4 border-b border-white/10 p-4 text-sm font-bold uppercase tracking-wider text-slate-300 sm:grid">
            <div className="col-span-2">Urun Adi</div>
            <div className="text-center">Fiyat</div>
            <div className="text-center">Stok Adedi</div>
          </div>

          <div className="space-y-2 p-2">
            {products.map((product) => {
              const displayStock = pendingChanges[product.id] !== undefined ? pendingChanges[product.id] : product.stock;
              const hasChanges =
                pendingChanges[product.id] !== undefined && pendingChanges[product.id] !== product.stock;

              return (
                <div
                  key={product.id}
                  className="grid grid-cols-1 items-start gap-3 rounded-xl border border-white/5 bg-slate-800/80 p-3 transition-all duration-300 hover:bg-slate-700/80 sm:grid-cols-4 sm:items-center sm:gap-4"
                >
                  <div className="flex items-center text-base font-medium sm:col-span-2 sm:text-lg">
                    <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 text-lg text-teal-400 shadow-inner sm:mr-4 sm:h-10 sm:w-10 sm:text-xl">
                      {product.name.charAt(0)}
                    </span>
                    <span className="truncate">{product.name}</span>
                  </div>

                  <div className="rounded-lg border border-black/20 bg-slate-900/50 px-2 py-1.5 text-center font-mono text-slate-300">
                    {product.price.toFixed(2)} TL
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-center">
                    <button
                      type="button"
                      onClick={() => handleDecrement(product.id, product.stock)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-xl font-bold text-red-400 shadow-lg transition-all duration-200 hover:bg-red-500 hover:text-white"
                    >
                      -
                    </button>

                    <span
                      className={`w-12 text-center text-2xl font-black drop-shadow-md ${
                        displayStock < 10 ? "text-red-400" : displayStock < 30 ? "text-yellow-400" : "text-green-400"
                      }`}
                    >
                      {displayStock}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleIncrement(product.id, product.stock)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-xl font-bold text-green-400 shadow-lg transition-all duration-200 hover:bg-green-500 hover:text-white"
                    >
                      +
                    </button>

                    {hasChanges && (
                      <button
                        type="button"
                        onClick={() => confirmStockUpdate(product.id)}
                        className="ml-0 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-bold text-white shadow-md transition-all hover:bg-teal-400 sm:ml-2"
                      >
                        Onayla
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {products.length === 0 && <div className="p-8 text-center text-slate-500">Kayitli urun bulunamadi.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default StockDashboard;
