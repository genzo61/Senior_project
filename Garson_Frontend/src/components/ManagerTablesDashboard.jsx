import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutGrid, AlertCircle, Loader2, RefreshCw, HandPlatter, Clock } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const ManagerTablesDashboard = () => {
    const [tables, setTables] = useState([]);
    const [allActiveOrders, setAllActiveOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);
    const [closingTable, setClosingTable] = useState(false);

    const backendUrl = `http://${window.location.hostname}:8085`;

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tablesRes, ordersRes] = await Promise.all([
                axios.get(`${backendUrl}/api/tables`),
                axios.get(`${backendUrl}/api/orders`)
            ]);
            setTables(tablesRes.data);
            setAllActiveOrders(ordersRes.data.filter(o => o.status !== 'PAID'));
            setError(null);
        } catch (err) {
            console.error('Veriler çekilirken hata:', err);
            setError('Veriler yüklenemedi. Lütfen bağlantıyı kontrol edin.');
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
                stompClient.subscribe('/topic/tables', (message) => {
                    setTables(JSON.parse(message.body));
                });
                
                stompClient.subscribe('/topic/orders', () => {
                   // Sipariş geldiğinde/gittiğinde yenile
                   axios.get(`${backendUrl}/api/orders`).then(res => {
                       setAllActiveOrders(res.data.filter(o => o.status !== 'PAID'));
                   });
                });
            }
        });

        stompClient.activate();

        return () => {
            if (stompClient.active) {
                stompClient.deactivate();
            }
        };
    }, []);

    const handleTableClick = (table) => {
        setSelectedTable(table);
    };

    const handleCloseTable = async () => {
        if (!selectedTable) return;
        setClosingTable(true);
        try {
            // Masa module'undan kapatınca varsayılan CASH gönderilir
            await axios.post(`${backendUrl}/api/tables/${selectedTable.id}/kapat?paymentMethod=CASH`);
            setSelectedTable(null);
        } catch (err) {
            console.error("Masa kapatılırken hata", err);
            alert("Masa kapatılırken bir hata oluştu.");
        } finally {
            setClosingTable(false);
        }
    };

    const getTableOrders = (tableId) => {
        return allActiveOrders.filter(o => o.tableNo == String(tableId) || o.tableNo === tableId);
    };

    const calculateTableTotal = (tableOrders) => {
        let total = 0;
        tableOrders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    total += (item.price || 0) * (item.quantity || item.qty); 
                });
            }
        });
        return total;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'EMPTY': return 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50';
            case 'OCCUPIED': return 'bg-blue-900/40 hover:bg-blue-800/50 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
            case 'CALLING_ROBOT': return 'bg-amber-900/40 hover:bg-amber-800/50 border-amber-500/50 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse';
            default: return 'bg-slate-800 border-slate-700';
        }
    };

    return (
        <div className="p-8 h-[calc(100vh-80px)] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <LayoutGrid className="text-indigo-400" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Masa Yönetimi
                        </h1>
                        <p className="text-slate-400">Restoran Düzeni ve Servis Kontrolü</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Yenile
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Table Grid */}
            {loading && tables.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="animate-spin text-indigo-400" size={48} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tables.sort((a,b) => a.id - b.id).map(table => {
                        const tOrders = getTableOrders(table.id);
                        const tTotal = calculateTableTotal(tOrders);
                        const isOccupied = table.status !== 'EMPTY';

                        return (
                            <div
                                key={table.id}
                                onClick={() => handleTableClick(table)}
                                className={`relative rounded-3xl p-6 border backdrop-blur-md cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col min-h-[220px] ${getStatusColor(table.status)}`}
                            >
                                {/* Masa Status Bar */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className={`text-4xl font-black ${isOccupied ? 'text-white' : 'text-slate-500'}`}>
                                            Masa {table.id}
                                        </span>
                                        {table.status === 'CALLING_ROBOT' && (
                                            <span className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1">
                                                <AlertCircle size={14} className="animate-bounce" /> Robot Çağrıldı
                                            </span>
                                        )}
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                        table.status === 'EMPTY' ? 'bg-slate-900 border-slate-700 text-slate-400' :
                                        table.status === 'OCCUPIED' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' :
                                        'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                    }`}>
                                        {table.status === 'EMPTY' ? 'Boş' : table.status === 'OCCUPIED' ? 'Dolu' : 'Çağrı'}
                                    </span>
                                </div>

                                {/* Masa İçeriği (Siparişler) */}
                                <div className="flex-1 overflow-hidden">
                                    {isOccupied && tOrders.length > 0 ? (
                                        <div className="space-y-2 mt-2">
                                           {tOrders.map(order => (
                                              order.items && order.items.map((item, idx) => (
                                                  <div key={`${order.id}-${idx}`} className="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                                                      <span className="text-slate-300 truncate pr-2">
                                                         <span className="text-indigo-400 font-bold mr-1">{item.qty || item.quantity}x</span>
                                                         {item.name || item.productName}
                                                      </span>
                                                      <span className="text-slate-400 font-mono text-xs">
                                                         ₺{((item.price || 0) * (item.quantity || item.qty)).toFixed(2)}
                                                      </span>
                                                  </div>
                                              ))
                                           )).flat().slice(0, 4)}
                                           
                                           {tOrders.reduce((acc, current) => acc + (current.items ? current.items.length : 0), 0) > 4 && (
                                              <div className="text-xs text-indigo-300/70 italic text-center mt-2">
                                                  + daha fazlası...
                                              </div>
                                           )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-500/50">
                                            <LayoutGrid size={32} className="mb-2" />
                                            {isOccupied ? 'Sipariş bekleniyor' : 'Masa Boş'}
                                        </div>
                                    )}
                                </div>

                                {/* Table Footer (Fiyat) */}
                                {isOccupied && (
                                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end">
                                        <span className="text-slate-400 text-xs font-medium">Toplam Tutar</span>
                                        <span className="text-2xl font-black text-white tracking-tight font-mono">
                                            ₺{tTotal.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Table Detail Modal */}
            {selectedTable && (
                <div className="fixed inset-0 z-[100] flex justify-end items-stretch bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTable(null)}>
                    <div 
                        className="w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl animate-in slide-in-from-right flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-slate-800/50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-3xl font-black">Masa {selectedTable.id}</h2>
                                    {selectedTable.status !== 'EMPTY' && (
                                       <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                                          <Clock size={14} /> Sipariş Detayları
                                       </p>
                                    )}
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                                    selectedTable.status === 'EMPTY' ? 'bg-slate-700 border-slate-600 text-slate-300' :
                                    selectedTable.status === 'OCCUPIED' ? 'bg-blue-900/40 border-blue-500/50 text-blue-400' :
                                    'bg-amber-900/40 border-amber-500/50 text-amber-400'
                                }`}>
                                    {selectedTable.status === 'EMPTY' ? 'Boş' : selectedTable.status === 'OCCUPIED' ? 'Dolu' : 'Robot Çağrıldı'}
                                </span>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            {selectedTable.status === 'EMPTY' ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                    <LayoutGrid size={64} className="mb-4 opacity-50 text-slate-600" />
                                    <p className="text-lg">Masa şu an boş.</p>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-indigo-300 border-b border-indigo-500/20 pb-3">
                                        <HandPlatter size={20} />
                                        Masa İçeriği
                                    </h3>
                                    
                                    {getTableOrders(selectedTable.id).length === 0 ? (
                                        <p className="text-slate-400 text-center py-8 text-sm bg-slate-800/50 rounded-xl border border-white/5">
                                            Masaya ait sipariş bulunamadı.<br/>(Müşteri robot çağırmış olabilir)
                                        </p>
                                    ) : (
                                        <div className="space-y-4 mb-8">
                                            {getTableOrders(selectedTable.id).map(order => (
                                                <div key={order.id} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 shadow-md">
                                                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                                                        <span className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-1 flex items-center gap-1 rounded border border-slate-800">
                                                            Sipariş #{order.id}
                                                        </span>
                                                        <span className={`text-xs px-2 py-1 rounded border font-semibold ${
                                                            order.status === 'READY' ? 'bg-green-900/40 border-green-500 text-green-400' : 
                                                            order.status === 'DELIVERED' ? 'bg-blue-900/40 border-blue-500 text-blue-400' :
                                                            'bg-amber-900/40 border-amber-500 text-amber-400'
                                                        }`}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    
                                                    <ul className="space-y-3">
                                                        {order.items && order.items.map((item, idx) => (
                                                            <li key={idx} className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-200">
                                                                    <span className="text-indigo-400 font-black mr-2 bg-indigo-500/10 px-1.5 py-0.5 rounded">{item.qty || item.quantity}x</span>
                                                                    {item.name || item.productName}
                                                                </span>
                                                                 <span className="text-slate-400 font-mono tracking-tighter text-sm">₺{((item.price || 0) * (item.quantity || item.qty)).toFixed(2)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {selectedTable.status !== 'EMPTY' && (
                            <div className="p-6 border-t border-white/10 bg-slate-800 mt-auto shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-slate-400 font-medium">Toplam Hesap</span>
                                    <span className="text-4xl font-black text-white font-mono tracking-tight">
                                        ₺{calculateTableTotal(getTableOrders(selectedTable.id)).toFixed(2)}
                                    </span>
                                </div>
                                
                                <button
                                    onClick={handleCloseTable}
                                    disabled={closingTable}
                                    className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg flex items-center justify-center gap-2 border border-slate-600 transition-all disabled:opacity-70"
                                >
                                    {closingTable ? (
                                        <Loader2 className="animate-spin" size={24} />
                                    ) : (
                                        <>Hesabı İptal Et / Masayı Boşalt</>
                                    )}
                                </button>
                                <p className="text-center text-xs text-slate-500 mt-3">
                                   Not: Ödeme işlemi için <b>Kasa</b> modülünü kullanın. <br/>Bu buton tamamen iptal işlemi içindir (Tüm siparişleri PAID işaretler).
                                </p>
                            </div>
                        )}
                        
                        {selectedTable.status === 'EMPTY' && (
                             <div className="p-6 border-t border-white/10 bg-slate-800/80 mt-auto text-right">
                                <button 
                                    onClick={() => setSelectedTable(null)}
                                    className="px-6 py-3 font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors border border-slate-600 w-full"
                                >
                                    Kapat
                                </button>
                             </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerTablesDashboard;
