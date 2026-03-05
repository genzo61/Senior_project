import { useEffect, useState, useRef } from 'react';
import OrderCard from './OrderCard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085';
const POLLING_INTERVAL = 1500;

function OrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('NEW'); // NEW or READY
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const audioRef = useRef(new Audio('/bell.mp3'));

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/orders?status=${activeTab}`);
      if (!response.ok) throw new Error('Sunucu hatası');
      const data = await response.json();
      
      setOrders((prev) => {
        // Yeni sipariş gelmiş mi kontrol et (Notification için)
        if (activeTab === 'NEW' && data.length > prev.length) {
          audioRef.current.play().catch(() => {});
        }
        return data;
      });
      setError(null);
    } catch (err) {
      console.error("Siparişler çekilemedi:", err);
      setError("Bağlantı hatası: Mutfak verileri güncellenemiyor.");
    }
  };

  useEffect(() => {
    // 1. Ilk acilista mevcut siparisleri HTTP uzerinden cek
    fetch(`http://${window.location.hostname}:8085/api/orders`)
      .then(res => res.json())
      .then(data => {
        // En yeni siparisler uste gelsin
        const sorted = data.sort((a,b) => b.id - a.id);
        setOrders(sorted);
      })
      .catch(err => console.error("Siparisler cekilemedi:", err));

    // 2. Canli siparisler icin WebSocket baglantisi
    const client = new Client({
      // brokerURL is used if direct ws is supported, but SockJS provides fallback
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8085/ws`),
      onConnect: () => {
        console.log('Connected to WebSocket!');
        client.subscribe('/topic/orders', (message) => {
          if (message.body) {
            const newOrder = JSON.parse(message.body);
            console.log('New order received: ', newOrder);
            
            // Play notification sound
            const audio = new Audio('/bell.mp3');
            audio.play().catch(e => console.log('Audio play ignored by browser until user interaction:', e));

            setOrders((prev) => [newOrder, ...prev]);
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, []);

  const handleFinishOrder = async (orderId) => {
    try {
      const response = await fetch(`http://${window.location.hostname}:8085/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (response.ok || response.status === 204) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        const errorMsg = await response.text();
        if (response.status === 400 && (errorMsg.toLowerCase().includes('stok') || errorMsg.toLowerCase().includes('stock') || errorMsg.toLowerCase().includes('insufficient'))) {
          alert("⚠️ Stok yetersiz: Sipariş hazır olarak işaretlenemedi.");
        } else if (response.status === 409) {
          alert("⚠️ Sipariş zaten READY veya geçiş geçersiz.");
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
            Yeni Siparişler ({activeTab === 'NEW' ? orders.length : '...'})
          </button>
          <button 
            onClick={() => setActiveTab('READY')}
            className={`px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'READY' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Hazır / Bekleyen ({activeTab === 'READY' ? orders.length : '...'})
          </button>
        </div>

        {error && (
          <div className="mt-4 text-red-400 text-sm animate-pulse bg-red-400/10 py-2 px-4 rounded-full w-fit mx-auto border border-red-400/20">
            ⚠️ {error}
          </div>
        )}
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 max-w-7xl mx-auto">
        {orders.length === 0 ? (
          <div className="col-span-full mt-10 flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 p-16 rounded-3xl border border-white/5 backdrop-blur-sm shadow-inner">
            <span className="text-7xl mb-6 opacity-30">
              {activeTab === 'NEW' ? '📭' : '🍽️'}
            </span>
            <p className="text-2xl font-light text-slate-400 italic">
              {activeTab === 'NEW' ? 'Henüz yeni sipariş yok...' : 'Hazır bekleyen sipariş yok.'}
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onStatusChange={handleStatusChange}
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
