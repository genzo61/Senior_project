import { useEffect, useState, useRef } from 'react';
import OrderCard from './OrderCard';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function OrdersDashboard() {
  const [allOrders, setAllOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('NEW'); // NEW or READY
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const audioRef = useRef(new Audio('/bell.mp3'));

  const displayedOrders = allOrders.filter(o => o.status === activeTab);

  useEffect(() => {
    // 1. Initial HTTP Fetch
    fetch(`http://${window.location.hostname}:8081/api/orders`)
      .then(res => res.json())
      .then(data => {
        const sorted = data.sort((a,b) => b.id - a.id);
        setAllOrders(sorted);
      })
      .catch(err => {
        console.error("Siparisler cekilemedi:", err);
        setError("Bağlantı hatası: Mutfak verileri güncellenemiyor.");
      });

    // 2. WebSocket Connection
    const client = new Client({
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8081/ws`),
      onConnect: () => {
        console.log('Connected to WebSocket!');
        client.subscribe('/topic/orders', (message) => {
          if (message.body) {
            const updatedOrder = JSON.parse(message.body);
            
            setAllOrders((prev) => {
              const exists = prev.find(o => o.id === updatedOrder.id);
              
              // Only ring for brand new orders
              if (!exists && updatedOrder.status === 'NEW') {
                  const audio = new Audio('/bell.mp3');
                  audio.play().catch(e => console.log('Audio ignored:', e));
              }
              
              if (exists) {
                 return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o).sort((a,b) => b.id - a.id);
              }
              return [updatedOrder, ...prev].sort((a,b) => b.id - a.id);
            });
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker error: ' + frame.headers['message']);
      },
    });

    client.activate();
    return () => client.deactivate();
  }, []);

  const handleFinishOrder = async (orderId, nextStatus) => {
    if (!nextStatus) return; // Fallback
    setUpdatingOrderId(orderId);
    try {
      const response = await fetch(`http://${window.location.hostname}:8081/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok || response.status === 204) {
        setAllOrders((prev) => 
            nextStatus === 'DELIVERED' 
               ? prev.filter((o) => o.id !== orderId) // Teslim edilince mutfak panelinden tamamen düşer
               : prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o)
        );
      } else {
        const errorMsg = await response.text();
        if (response.status === 400 && (errorMsg.toLowerCase().includes('stok') || errorMsg.toLowerCase().includes('stock') || errorMsg.toLowerCase().includes('insufficient'))) {
          alert("⚠️ Stok yetersiz: Sipariş hazır olarak işaretlenemedi.");
        } else if (response.status === 409) {
          alert(`⚠️ Sipariş zaten ${nextStatus} veya geçiş geçersiz.`);
        } else {
          alert(`Hata: ${errorMsg || "Status güncellenemedi."}`);
        }
      }             
    } catch (error) {
       console.error("Güncelleme hatası:", error);
       alert("Sunucuya bağlanılamadı.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="w-full min-h-screen p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-10 text-center relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 drop-shadow-sm">
          👨‍🍳 Mutfak Yönetim Paneli
        </h1>
        
        {/* Tabs Control */}
        <div className="flex justify-center p-1 bg-slate-800/50 backdrop-blur-md rounded-2xl w-fit mx-auto border border-white/5 shadow-2xl">
          <button 
            onClick={() => setActiveTab('NEW')}
            className={`px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'NEW' 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Yeni Siparişler ({allOrders.filter(o => o.status === 'NEW').length})
          </button>
          <button 
            onClick={() => setActiveTab('READY')}
            className={`px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'READY' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Hazır / Bekleyen ({allOrders.filter(o => o.status === 'READY').length})
          </button>
        </div>

        {error && (
          <div className="mt-4 text-red-400 text-sm animate-pulse bg-red-400/10 py-2 px-4 rounded-full w-fit mx-auto border border-red-400/20">
            ⚠️ {error}
          </div>
        )}
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 max-w-7xl mx-auto">
        {displayedOrders.length === 0 ? (
          <div className="col-span-full mt-10 flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 p-16 rounded-3xl border border-white/5 backdrop-blur-sm shadow-inner">
            <span className="text-7xl mb-6 opacity-30">
              {activeTab === 'NEW' ? '📭' : '🍽️'}
            </span>
            <p className="text-2xl font-light text-slate-400 italic">
              {activeTab === 'NEW' ? 'Henüz yeni sipariş yok...' : 'Hazır bekleyen sipariş yok.'}
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onStatusChange={handleFinishOrder}
              nextStatus={activeTab === 'NEW' ? 'READY' : 'DELIVERED'}
              isLoading={updatingOrderId === order.id}
            />
          ))
        )}
      </main>
    </div>
  );
}

export default OrdersDashboard;
