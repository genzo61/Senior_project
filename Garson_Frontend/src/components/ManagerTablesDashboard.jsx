import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutGrid, AlertCircle, Loader2, RefreshCw, HandPlatter } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const ManagerTablesDashboard = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableOrders, setTableOrders] = useState([]);
    const [closingTable, setClosingTable] = useState(false);

    // Fetch initial tables
    const fetchTables = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:8080/api/tables');
            setTables(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching tables:', err);
            setError('Masalar yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // WebSocket Connection
    useEffect(() => {
        fetchTables();

        const socket = new SockJS('http://localhost:8080/ws');
        const stompClient = new Client({
            webSocketFactory: () => socket,
            onConnect: () => {
                console.log('WebSocket Bağlantısı Başarılı - Masalar');
                stompClient.subscribe('/topic/tables', (message) => {
                    const updatedTables = JSON.parse(message.body);
                    setTables(updatedTables);
                });
                
                // Also subscribe to specific order updates to refresh modal if open
                stompClient.subscribe('/topic/orders', () => {
                    // Logic to update currently open modal could go here, 
                    // or rely on modal re-fetching when opened.
                });
            },
            onStompError: (frame) => {
                console.error('WebSocket Hatası:', frame.headers['message']);
            }
        });

        stompClient.activate();

        return () => {
            if (stompClient.active) {
                stompClient.deactivate();
            }
        };
    }, []);

    // Handle clicking a table
    const handleTableClick = async (table) => {
        setSelectedTable(table);
        if (table.status !== 'EMPTY') {
             try {
                 // Sadece secili masanin aktif siparişlerini getir
                 const response = await axios.get('http://localhost:8080/api/orders');
                 // TODO: Backend'de filter eklenecek, su an hepsini cekip client'ta filtreleniyor
                 const activeOrders = response.data.filter(order => 
                     order.tableNo === String(table.id) && 
                     order.status !== 'PAID'
                 );
                 setTableOrders(activeOrders);
             } catch (err) {
                 console.error("Error fetching orders for table", err);
             }
        } else {
             setTableOrders([]);
        }
    };

    // Handle closing a table
    const handleCloseTable = async () => {
        if (!selectedTable) return;
        setClosingTable(true);
        try {
            await axios.post(`http://localhost:8080/api/tables/${selectedTable.id}/kapat`);
            setSelectedTable(null);
            setTableOrders([]);
        } catch (err) {
            console.error("Error closing table", err);
            alert("Masa kapatılırken bir hata oluştu.");
        } finally {
            setClosingTable(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'EMPTY': return 'bg-slate-700 hover:bg-slate-600 border-slate-600';
            case 'OCCUPIED': return 'bg-blue-600/40 hover:bg-blue-500/50 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
            case 'CALLING_ROBOT': return 'bg-amber-500/40 hover:bg-amber-400/50 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse';
            default: return 'bg-slate-700 border-slate-600';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'EMPTY': return 'Boş';
            case 'OCCUPIED': return 'Dolu';
            case 'CALLING_ROBOT': return 'Robot Çağrıldı';
            default: return 'Bilinmiyor';
        }
    };

    // Calculate total bill for the selected table
    const calculateTotal = () => {
        let total = 0;
        tableOrders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    // Assuming items have a price or we get it from product, 
                    // the original OrderItem entity doesn't have price. 
                    // Let's assume we show quantity for now or need backend adjustment for price calculation in Orders.
                    total += (item.price || 0) * (item.quantity || item.qty); 
                });
            }
        });
        return total;
    };

    return (
        <div className="p-8 h-[calc(100vh-80px)] overflow-y-auto">
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
                    onClick={fetchTables}
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {tables.sort((a,b) => a.id - b.id).map(table => (
                        <div
                            key={table.id}
                            onClick={() => handleTableClick(table)}
                            className={`relative rounded-3xl p-6 border-2 backdrop-blur-sm cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center justify-center min-h-[160px]
                                ${getStatusColor(table.status)}
                            `}
                        >
                            <span className="text-4xl font-black mb-2 opacity-90 text-white">
                                {table.id}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-black/30 text-sm font-medium tracking-wide text-white/90">
                                {getStatusText(table.status)}
                            </span>
                            
                            {table.status === 'CALLING_ROBOT' && (
                                <div className="absolute top-3 right-3 text-amber-300">
                                    <AlertCircle size={24} className="animate-bounce" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Table Detail Modal */}
            {selectedTable && (
                <div className="fixed inset-0 z-[100] flex justify-end items-stretch bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTable(null)}>
                    <div 
                        className="w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl animate-in slide-in-from-right flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-slate-800/50">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-3xl font-black">Masa {selectedTable.id}</h2>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                                    selectedTable.status === 'EMPTY' ? 'bg-slate-700 border-slate-600 text-slate-300' :
                                    selectedTable.status === 'OCCUPIED' ? 'bg-blue-900/40 border-blue-500/50 text-blue-400' :
                                    'bg-amber-900/40 border-amber-500/50 text-amber-400'
                                }`}>
                                    {getStatusText(selectedTable.status)}
                                </span>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {selectedTable.status === 'EMPTY' ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                    <LayoutGrid size={48} className="mb-4 opacity-50" />
                                    <p>Masa şu an boş.</p>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-indigo-300 border-b border-white/10 pb-3">
                                        <HandPlatter size={20} />
                                        Aktif Siparişler
                                    </h3>
                                    
                                    {tableOrders.length === 0 ? (
                                        <p className="text-slate-400 text-center py-4 text-sm">Masaya ait aktif sipariş bulunamadı. (Sistemden çağrı yapılmış olabilir)</p>
                                    ) : (
                                        <div className="space-y-4 mb-8">
                                            {tableOrders.map(order => (
                                                <div key={order.id} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 flex items-center gap-1 rounded">
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
                                                    
                                                    <ul className="space-y-2 mt-2 border-t border-slate-700/50 pt-2">
                                                        {order.items && order.items.map((item, idx) => (
                                                            <li key={idx} className="flex justify-between items-center text-sm">
                                                                <span className="text-white/90">
                                                                    <span className="text-indigo-400 font-bold mr-2">{item.qty || item.quantity}x</span>
                                                                    {item.name || item.productName}
                                                                </span>
                                                                {/* <span className="text-slate-400 font-mono">₺{(item.price || 0) * (item.qty || item.quantity)}</span> */}
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
                            <div className="p-6 border-t border-white/10 bg-slate-800/80 mt-auto">
                                {/* Total Amount Calculation if we had prices */}
                                {/* <div className="flex justify-between items-center mb-6">
                                    <span className="text-slate-400 font-medium text-lg">Toplam</span>
                                    <span className="text-3xl font-black text-white font-mono tracking-tight">₺{calculateTotal().toFixed(2)}</span>
                                </div> */}
                                
                                <button
                                    onClick={handleCloseTable}
                                    disabled={closingTable}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all disabled:opacity-70"
                                >
                                    {closingTable ? (
                                        <Loader2 className="animate-spin" size={24} />
                                    ) : (
                                        <>Hesabı Al / Masayı Kapat</>
                                    )}
                                </button>
                            </div>
                        )}
                        
                        {/* Close button for empty tables */}
                        {selectedTable.status === 'EMPTY' && (
                             <div className="p-6 border-t border-white/10 bg-slate-800/80 mt-auto text-right">
                                <button 
                                    onClick={() => setSelectedTable(null)}
                                    className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
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
