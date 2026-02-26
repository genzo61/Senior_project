import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import OrderCard from './OrderCard';

function OrdersDashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // 1. Ilk acilista mevcut siparisleri HTTP uzerinden cek
    fetch('http://127.0.0.1:8085/api/orders')
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
      webSocketFactory: () => new SockJS('http://127.0.0.1:8085/ws'),
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
      const response = await fetch(`http://127.0.0.1:8085/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (response.ok || response.status === 204) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        console.error("Sipariş silinirken hata oluştu!");
      }             
    } catch (error) {
       console.error("Sunucuya bağlanılamadı:", error);   
    }
  };

  return (
    <div className="w-full min-h-screen p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-10 text-center relative z-10 flex flex-col items-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-sm">
          👨‍🍳 Canlı Mutfak Ekranı (KDS)
        </h1>
        <p className="text-slate-400">Bekleyen Sipariş Sayısı: {orders.length}</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
        {orders.length === 0 ? (
          <div className="col-span-full mt-20 flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 p-12 rounded-3xl border border-white/5 backdrop-blur-sm mx-auto max-w-2xl">
            <span className="text-6xl mb-6 opacity-80">🍽️</span>
            <p className="text-2xl font-light text-slate-400">Bekleyen sipariş yok, <span className="text-slate-300 font-medium">mutfak temiz!</span></p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onFinish={handleFinishOrder} />
          ))
        )}
      </main>
    </div>
  );
}

export default OrdersDashboard;
