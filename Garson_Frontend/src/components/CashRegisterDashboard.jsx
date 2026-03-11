import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Banknote, CreditCard, Wallet, Search, CheckCircle2, AlertCircle, RefreshCw, LayoutGrid } from "lucide-react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const CashRegisterDashboard = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Stats
  const [dailyTotal, setDailyTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [cardTotal, setCardTotal] = useState(0);

  const backendUrl = `http://${window.location.hostname}:8081`;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch Tables
      const tablesRes = await axios.get(`${backendUrl}/api/tables`);
      // Sadece dolu veya çağrı yapan masaları kasaya al
      const activeTables = tablesRes.data.filter((t) => t.status !== "EMPTY");
      setTables(activeTables);

      // Fetch Daily Paid Orders
      const paidRes = await axios.get(`${backendUrl}/api/orders/paid`);
      const paidOrders = paidRes.data;
      
      let _total = 0;
      let _cash = 0;
      let _card = 0;

      paidOrders.forEach((o) => {
        let orderTotal = 0;
        if (o.items) {
          o.items.forEach((item) => {
             orderTotal += (item.price || 0) * (item.quantity || item.qty);
          });
        }
        _total += orderTotal;
        if (o.paymentMethod === "CASH") _cash += orderTotal;
        if (o.paymentMethod === "CARD") _card += orderTotal;
      });

      setDailyTotal(_total);
      setCashTotal(_cash);
      setCardTotal(_card);
      
    } catch (err) {
      console.error("Kasaya veri çekilirken hata:", err);
      setError("Veriler yüklenemedi. Bağlantıyı kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = new SockJS(`${backendUrl}/ws`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        stompClient.subscribe("/topic/tables", (message) => {
          const updatedTables = JSON.parse(message.body);
          setTables(updatedTables.filter((t) => t.status !== "EMPTY"));
          // Eğer seçilen masa kapandıysa ekranı temizle
          setSelectedTable((currentSelected) => {
             if (currentSelected) {
                 const stillActive = updatedTables.find(t => t.id === currentSelected.id && t.status !== "EMPTY");
                 if (!stillActive && !paymentSuccess) return null; // Kapanmış
             }
             return currentSelected;
          });
        });
        
        stompClient.subscribe("/topic/orders", () => {
          // Bir sipariş eklendiğinde/silindiğinde açık masa siparişlerini yenile
          if (selectedTable) {
             loadTableOrders(selectedTable.id);
          }
        });
      },
    });
    stompClient.activate();

    return () => {
      if (stompClient.active) {
        stompClient.deactivate();
      }
    };
  }, []);

  const loadTableOrders = async (tableId) => {
    try {
      const res = await axios.get(`${backendUrl}/api/orders/table/${tableId}`);
      setTableOrders(res.data);
    } catch (err) {
      console.error(`Masa ${tableId} siparişleri alınamadı:`, err);
    }
  };

  const handleTableClick = (table) => {
    setPaymentSuccess(false);
    setSelectedTable(table);
    loadTableOrders(table.id);
  };

  const calculateTotal = () => {
    let total = 0;
    tableOrders.forEach((order) => {
      if (order.items) {
        order.items.forEach((item) => {
          total += (item.price || 0) * (item.quantity || item.qty);
        });
      }
    });
    return total;
  };

  const handlePayment = async (method) => {
    if (!selectedTable) return;
    setIsProcessing(true);
    setPaymentSuccess(false);
    try {
      await axios.post(`${backendUrl}/api/tables/${selectedTable.id}/kapat?paymentMethod=${method}`);
      setPaymentSuccess(true);
      fetchData(); // Raporu güncelle
      setTimeout(() => {
         setSelectedTable(null);
         setPaymentSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Ödeme alınamadı", err);
      setError("Ödeme işlemi başarısız oldu.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-screen p-8 text-white relative overflow-hidden bg-slate-900">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="mb-8 flex justify-between items-center relative z-10">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            Kasa Yönetimi
          </h1>
          <p className="text-slate-400 mt-1">Ödemeler ve Günlük Ciro Takibi</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-slate-800/80 border border-white/10 rounded-xl px-6 py-3 shadow-lg flex flex-col items-center">
             <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Günlük Ciro</span>
             <span className="text-2xl font-black text-emerald-400 font-mono">₺{dailyTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={fetchData}
            className="h-full px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 transition-colors flex items-center"
          >
            <RefreshCw size={20} className={loading && !isProcessing ? "animate-spin text-slate-400" : "text-slate-400"} />
          </button>
        </div>
      </header>

      {error && (
         <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
             <AlertCircle size={20} /> {error}
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 h-[calc(100vh-220px)]">
        
        {/* Sol Panel: Açık Masalar */}
        <div className="col-span-1 bg-slate-800/50 backdrop-blur-md rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <LayoutGrid className="text-emerald-400" />
            <h2 className="text-xl font-bold">Açık Masalar</h2>
            <span className="ml-auto bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
              {tables.length} Masa
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {tables.length === 0 && !loading && (
               <div className="text-center text-slate-500 py-10">Açık masa bulunmuyor.</div>
            )}
            
            {tables.sort((a,b) => a.id - b.id).map(table => (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex justify-between items-center group
                  ${selectedTable?.id === table.id 
                    ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-900/50 border-white/5 hover:border-emerald-500/30 hover:bg-slate-800'
                  }`}
              >
                <div>
                  <h3 className={`text-xl font-black ${selectedTable?.id === table.id ? 'text-emerald-400' : 'text-slate-200'}`}>
                    Masa {table.id}
                  </h3>
                  <span className={`text-xs mt-1 px-2 py-0.5 rounded-md inline-block ${
                      table.status === 'CALLING_ROBOT' ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                      {table.status === 'CALLING_ROBOT' ? 'Robot Çağrıldı' : 'Dolu'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                   <Banknote size={18} className={selectedTable?.id === table.id ? 'text-emerald-400' : 'text-slate-400'} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sağ Panel: Hesap Detayı ve Ödeme */}
        <div className="col-span-1 lg:col-span-2 bg-slate-800/50 backdrop-blur-md rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
               <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 mb-6 shadow-inner">
                  <Wallet size={40} className="text-slate-600" />
               </div>
               <p className="text-xl font-medium">Hesap kesmek için soldan masa seçin</p>
            </div>
          ) : (
            <>
              {/* Hesap Başlığı */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div>
                   <h2 className="text-3xl font-black text-white">Masa {selectedTable.id} Hesabı</h2>
                   <p className="text-slate-400 text-sm mt-1">{tableOrders.length} aktif sipariş</p>
                </div>
                <div className="text-right">
                   <div className="text-4xl font-mono font-black text-white tracking-tight">
                     ₺{calculateTotal().toFixed(2)}
                   </div>
                </div>
              </div>

              {/* Sipariş Kalemleri */}
              <div className="flex-1 overflow-y-auto mb-6 bg-slate-900/50 rounded-2xl border border-white/5 p-4 custom-scrollbar">
                 {tableOrders.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">Kayıtlı sipariş kalemi bulunamadı.</div>
                 ) : (
                    <div className="space-y-4">
                       {tableOrders.map(order => (
                          <div key={order.id} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">
                                    Sipariş #{order.id}
                                </span>
                                <span className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300">
                                    {order.status}
                                </span>
                            </div>
                            <ul className="space-y-2 mt-2 border-t border-slate-700/50 pt-3">
                                {order.items && order.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center">
                                            <span className="text-emerald-400 font-bold w-6 text-right mr-3">{item.qty || item.quantity}x</span>
                                            <span className="text-slate-200 text-base">{item.name || item.productName}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-500 text-xs">(₺{item.price?.toFixed(2)})</span>
                                            <span className="text-white font-mono font-medium text-base w-16 text-right">
                                                ₺{((item.price || 0) * (item.quantity || item.qty)).toFixed(2)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                          </div>
                       ))}
                    </div>
                 )}
              </div>

              {/* Alt Action Alanı */}
              <div className="grid grid-cols-2 gap-4">
                {paymentSuccess ? (
                   <div className="col-span-2 py-5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center gap-3 text-emerald-400 font-bold text-xl animate-in fade-in slide-in-from-bottom-2">
                      <CheckCircle2 size={28} /> Ödeme Başarıyla Alındı
                   </div>
                ) : (
                   <>
                    <button
                        onClick={() => handlePayment("CASH")}
                        disabled={isProcessing || tableOrders.length === 0}
                        className="py-5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-2xl text-xl flex flex-col items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                    >
                        <Banknote size={28} />
                        Nakit Ödeme Al
                    </button>
                    <button
                        onClick={() => handlePayment("CARD")}
                        disabled={isProcessing || tableOrders.length === 0}
                        className="py-5 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold rounded-2xl text-xl flex flex-col items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                    >
                        <CreditCard size={28} />
                        Kredi Kartı
                    </button>
                   </>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashRegisterDashboard;
