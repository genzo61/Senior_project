import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LayoutGrid, AlertCircle, Loader2, RefreshCw, HandPlatter, Clock } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { backendBaseUrl, backendWsUrl } from '../config/backendUrl';

const ManagerTablesDashboard = () => {
  const [tables, setTables] = useState([]);
  const [allActiveOrders, setAllActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [closingTable, setClosingTable] = useState(false);

  const backendUrl = backendBaseUrl;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tablesRes, ordersRes] = await Promise.all([
        axios.get(`${backendUrl}/api/tables`),
        axios.get(`${backendUrl}/api/orders`),
      ]);
      setTables(tablesRes.data);
      setAllActiveOrders(ordersRes.data.filter((o) => o.status !== 'PAID'));
      setError(null);
    } catch (err) {
      console.error('Veriler cekilirken hata:', err);
      setError('Veriler yuklenemedi. Lutfen baglantiyi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = new SockJS(backendWsUrl);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        stompClient.subscribe('/topic/tables', (message) => {
          setTables(JSON.parse(message.body));
        });

        stompClient.subscribe('/topic/orders', () => {
          axios.get(`${backendUrl}/api/orders`).then((res) => {
            setAllActiveOrders(res.data.filter((o) => o.status !== 'PAID'));
          }).catch((err) => {
            console.error('Siparisler yenilenemedi:', err);
          });
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

  const handleTableClick = (table) => {
    setSelectedTable(table);
  };

  const handleCloseTable = async () => {
    if (!selectedTable) return;

    setClosingTable(true);
    try {
      // Closing from this module uses CASH by default.
      await axios.post(`${backendUrl}/api/tables/${selectedTable.id}/kapat?paymentMethod=CASH`);
      setSelectedTable(null);
    } catch (err) {
      console.error('Masa kapatilirken hata', err);
      alert('Masa kapatilirken bir hata olustu.');
    } finally {
      setClosingTable(false);
    }
  };

  const getTableOrders = (tableId) => {
    const normalizedTableId = String(tableId);
    return allActiveOrders.filter((o) => String(o.tableNo) === normalizedTableId);
  };

  const calculateTableTotal = (tableOrders) => {
    let total = 0;
    tableOrders.forEach((order) => {
      if (order.items) {
        order.items.forEach((item) => {
          total += (item.price || 0) * (item.quantity || item.qty || 0);
        });
      }
    });
    return total;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'EMPTY':
        return 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/50';
      case 'OCCUPIED':
        return 'bg-blue-900/40 hover:bg-blue-800/50 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
      case 'CALLING_ROBOT':
        return 'bg-amber-900/40 hover:bg-amber-800/50 border-amber-500/50 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse';
      default:
        return 'bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="min-h-[calc(100vh-76px)] overflow-y-auto p-3 sm:min-h-[calc(100vh-86px)] sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="rounded-xl bg-indigo-500/20 p-2.5 sm:p-3">
            <LayoutGrid className="text-indigo-400" size={32} />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
              Masa Yonetimi
            </h1>
            <p className="text-sm text-slate-400 sm:text-base">Restoran duzeni ve servis kontrolu</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 transition-all hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 sm:w-auto"
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

      {loading && tables.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-indigo-400" size={48} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...tables].sort((a, b) => a.id - b.id).map((table) => {
            const tOrders = getTableOrders(table.id);
            const tTotal = calculateTableTotal(tOrders);
            const isOccupied = table.status !== 'EMPTY';

            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`relative flex min-h-[200px] cursor-pointer flex-col rounded-3xl border p-4 backdrop-blur-md transition-all duration-300 transform hover:-translate-y-1 sm:min-h-[220px] sm:p-6 ${getStatusColor(table.status)}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className={`text-3xl font-black sm:text-4xl ${isOccupied ? 'text-white' : 'text-slate-500'}`}>
                      Masa {table.id}
                    </span>
                    {table.status === 'CALLING_ROBOT' && (
                      <span className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={14} className="animate-bounce" /> Robot Cagrildi
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      table.status === 'EMPTY'
                        ? 'bg-slate-900 border-slate-700 text-slate-400'
                        : table.status === 'OCCUPIED'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    {table.status === 'EMPTY' ? 'Bos' : table.status === 'OCCUPIED' ? 'Dolu' : 'Cagri'}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  {isOccupied && tOrders.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {tOrders
                        .map((order) =>
                          order.items?.map((item, idx) => (
                            <div key={`${order.id}-${idx}`} className="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                              <span className="text-slate-300 truncate pr-2">
                                <span className="text-indigo-400 font-bold mr-1">{item.qty || item.quantity}x</span>
                                {item.name || item.productName}
                              </span>
                              <span className="text-slate-400 font-mono text-xs">
                                TL {((item.price || 0) * (item.quantity || item.qty || 0)).toFixed(2)}
                              </span>
                            </div>
                          ))
                        )
                        .flat()
                        .slice(0, 4)}

                      {tOrders.reduce((acc, current) => acc + (current.items ? current.items.length : 0), 0) > 4 && (
                        <div className="text-xs text-indigo-300/70 italic text-center mt-2">+ daha fazlasi...</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-500/50">
                      <LayoutGrid size={32} className="mb-2" />
                      {isOccupied ? 'Siparis bekleniyor' : 'Masa Bos'}
                    </div>
                  )}
                </div>

                {isOccupied && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end">
                    <span className="text-slate-400 text-xs font-medium">Toplam Tutar</span>
                    <span className="font-mono text-xl font-black tracking-tight text-white sm:text-2xl">TL {tTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedTable && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-end bg-black/60 backdrop-blur-sm animate-in fade-in md:items-stretch"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="flex h-[88vh] w-full flex-col rounded-t-2xl border-t border-white/10 bg-slate-900 shadow-2xl animate-in slide-in-from-bottom md:h-full md:max-w-md md:rounded-none md:border-l md:border-t-0 md:slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 bg-slate-800/50 p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-black sm:text-3xl">Masa {selectedTable.id}</h2>
                  {selectedTable.status !== 'EMPTY' && (
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                      <Clock size={14} /> Siparis Detaylari
                    </p>
                  )}
                </div>
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                    selectedTable.status === 'EMPTY'
                      ? 'bg-slate-700 border-slate-600 text-slate-300'
                      : selectedTable.status === 'OCCUPIED'
                        ? 'bg-blue-900/40 border-blue-500/50 text-blue-400'
                        : 'bg-amber-900/40 border-amber-500/50 text-amber-400'
                  }`}
                >
                  {selectedTable.status === 'EMPTY' ? 'Bos' : selectedTable.status === 'OCCUPIED' ? 'Dolu' : 'Robot Cagrildi'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6">
              {selectedTable.status === 'EMPTY' ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <LayoutGrid size={64} className="mb-4 opacity-50 text-slate-600" />
                  <p className="text-lg">Masa su an bos.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-indigo-300 border-b border-indigo-500/20 pb-3">
                    <HandPlatter size={20} />
                    Masa Icerigi
                  </h3>

                  {getTableOrders(selectedTable.id).length === 0 ? (
                    <p className="text-slate-400 text-center py-8 text-sm bg-slate-800/50 rounded-xl border border-white/5">
                      Masaya ait siparis bulunamadi.
                      <br />
                      (Musteri robot cagirmis olabilir)
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {getTableOrders(selectedTable.id).map((order) => (
                        <div key={order.id} className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 shadow-md sm:p-4">
                          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                            <span className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-1 flex items-center gap-1 rounded border border-slate-800">
                              Siparis #{order.id}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded border font-semibold ${
                                order.status === 'READY'
                                  ? 'bg-green-900/40 border-green-500 text-green-400'
                                  : order.status === 'DELIVERED'
                                    ? 'bg-blue-900/40 border-blue-500 text-blue-400'
                                    : 'bg-amber-900/40 border-amber-500 text-amber-400'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <ul className="space-y-3">
                            {order.items?.map((item, idx) => (
                              <li key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-slate-200">
                                  <span className="text-indigo-400 font-black mr-2 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                    {item.qty || item.quantity}x
                                  </span>
                                  {item.name || item.productName}
                                </span>
                                <span className="text-slate-400 font-mono tracking-tighter text-sm">
                                  TL {((item.price || 0) * (item.quantity || item.qty || 0)).toFixed(2)}
                                </span>
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

            {selectedTable.status !== 'EMPTY' && (
              <div className="mt-auto border-t border-white/10 bg-slate-800 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] sm:p-6">
                <div className="mb-5 flex items-center justify-between sm:mb-6">
                  <span className="text-slate-400 font-medium">Toplam Hesap</span>
                  <span className="font-mono text-3xl font-black tracking-tight text-white sm:text-4xl">
                    TL {calculateTableTotal(getTableOrders(selectedTable.id)).toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={handleCloseTable}
                  disabled={closingTable}
                  className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg flex items-center justify-center gap-2 border border-slate-600 transition-all disabled:opacity-70"
                >
                  {closingTable ? <Loader2 className="animate-spin" size={24} /> : <>Hesabi Iptal Et / Masayi Bosalt</>}
                </button>
                <p className="text-center text-xs text-slate-500 mt-3">
                  Not: Odeme islemi icin <b>Kasa</b> modulunu kullanin.
                  <br />
                  Bu buton tamamen iptal islemi icindir (Tum siparisleri PAID isaretler).
                </p>
              </div>
            )}

            {selectedTable.status === 'EMPTY' && (
              <div className="mt-auto border-t border-white/10 bg-slate-800/80 p-4 text-right sm:p-6">
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
