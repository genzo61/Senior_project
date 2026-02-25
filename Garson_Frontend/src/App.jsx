import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import OrderCard from './components/OrderCard';

function App() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // 1. Ilk acilista mevcut siparisleri HTTP uzerinden cek
    fetch('http://127.0.0.1:8081/api/orders')
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
      webSocketFactory: () => new SockJS('http://127.0.0.1:8081/ws'),
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

  const handleFinishOrder = (orderId) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  return (
    <div className="w-full min-h-screen p-8 text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-10 text-center relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          👨‍🍳 Canlı Mutfak Ekranı (KDS)
        </h1>
        <p className="text-slate-400">Bekleyen Sipariş Sayısı: {orders.length}</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
        {orders.length === 0 ? (
          <div className="col-span-full mt-20 flex flex-col items-center justify-center text-slate-500">
            <span className="text-6xl mb-4">🍽️</span>
            <p className="text-xl">Bekleyen sipariş yok, mutfak temiz!</p>
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

export default App;
