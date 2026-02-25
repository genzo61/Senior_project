import { useEffect, useState } from "react";
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function StockDashboard() {
  const [products, setProducts] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();

    // Canlı Stock güncellemeleri için WebSocket
    const client = new Client({
      webSocketFactory: () => new SockJS('http://127.0.0.1:8081/ws'),
      onConnect: () => {
        console.log('StockDashboard WebSocket Connected!');
        client.subscribe('/topic/products', (message) => {
          if (message.body) {
            const updatedProducts = JSON.parse(message.body);
            setProducts(updatedProducts);
          }
        });
      }
    });
    client.activate();

    return () => {
      client.deactivate();
    };

  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8081/api/products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Ürünler çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = (id, currentStock) => {
    const change = pendingChanges[id] !== undefined ? pendingChanges[id] : currentStock;
    setPendingChanges({ ...pendingChanges, [id]: change + 1 });
  };

  const handleDecrement = (id, currentStock) => {
    const change = pendingChanges[id] !== undefined ? pendingChanges[id] : currentStock;
    if (change > 0) {
      setPendingChanges({ ...pendingChanges, [id]: change - 1 });
    }
  };

  const confirmStockUpdate = async (id) => {
    if (pendingChanges[id] === undefined) return;
    const newStock = pendingChanges[id];
    
    try {
      const res = await fetch(`http://127.0.0.1:8081/api/products/${id}/stock?quantity=${newStock}`, {
        method: 'PUT'
      });
      if (res.ok) {
        // Clear pending change for this id after success
        const newPending = { ...pendingChanges };
        delete newPending[id];
        setPendingChanges(newPending);
        // Products will also auto-update via WebSockets, but we do optimistic update
        setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
      }
    } catch (err) {
      console.error("Stok güncellenemedi:", err);
    }
  };

  if (loading)
    return (
      <div className="text-center mt-20 text-xl text-white">Yükleniyor...</div>
    );

  return (
    <div className="w-full min-h-screen p-8 text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-green-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-teal-500/20 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-10 text-center relative z-10 flex flex-col items-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400 drop-shadow-sm">
          📦 Stok & Menü Yönetimi
        </h1>
        <p className="text-slate-400 max-w-lg mb-6 leading-relaxed">
          Mutfaktaki anlık stok durumlarını buradan takip edebilir, bittikçe
          güncelleyebilirsiniz. Bu stoklar robotun menüsünü anlık olarak
          etkiler.
        </p>
      </header>

      <main className="max-w-5xl mx-auto relative z-10">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-white/10 font-bold text-slate-300 text-sm uppercase tracking-wider">
            <div className="col-span-2">Ürün Adı</div>
            <div className="text-center">Fiyat</div>
            <div className="text-center">Stok Adedi</div>
          </div>

          <div className="p-2 space-y-2">
            {products.map((product) => {
              const displayStock = pendingChanges[product.id] !== undefined ? pendingChanges[product.id] : product.stock;
              const hasChanges = pendingChanges[product.id] !== undefined && pendingChanges[product.id] !== product.stock;
              
              return (
                <div key={product.id} className="grid grid-cols-4 gap-4 p-3 items-center rounded-xl bg-slate-800/80 border border-white/5 hover:bg-slate-700/80 transition-all duration-300 group">
                  <div className="col-span-2 flex items-center font-medium text-lg">
                    <span className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center mr-4 text-xl shadow-inner">
                       {product.name.charAt(0)}
                    </span>
                    {product.name}
                  </div>
                  
                  <div className="text-center font-mono text-slate-300 bg-slate-900/50 py-1.5 rounded-lg border border-black/20">
                    {product.price.toFixed(2)} ₺
                  </div>
                  
                  <div className="flex justify-center items-center gap-2">
                    <button 
                      onClick={() => handleDecrement(product.id, product.stock)}
                      className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-500/20 flex items-center justify-center text-xl font-bold shadow-lg"
                    >
                      -
                    </button>
                    
                    <span className={`text-2xl font-black w-12 text-center drop-shadow-md ${displayStock < 10 ? 'text-red-400' : displayStock < 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {displayStock}
                    </span>
                    
                    <button 
                      onClick={() => handleIncrement(product.id, product.stock)}
                      className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all duration-200 border border-green-500/20 flex items-center justify-center text-xl font-bold shadow-lg"
                    >
                      +
                    </button>
                    
                    {hasChanges && (
                      <button 
                        onClick={() => confirmStockUpdate(product.id)}
                        className="ml-4 bg-teal-500 hover:bg-teal-400 text-white font-bold py-1.5 px-3 rounded-lg text-sm shadow-md transition-all"
                      >
                        Onayla
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                Kayıtlı ürün bulunamadı.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default StockDashboard;
