import React, { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, Wallet, CheckCircle2, AlertCircle, RefreshCw, LayoutGrid } from "lucide-react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { backendBaseUrl, backendWsUrl } from "../config/backendUrl";

const CashRegisterDashboard = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [dailyTotal, setDailyTotal] = useState(0);

  const selectedTableRef = useRef(null);
  const paymentSuccessRef = useRef(false);

  const backendUrl = backendBaseUrl;

  selectedTableRef.current = selectedTable;
  paymentSuccessRef.current = paymentSuccess;

  const parseDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const isSameLocalDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tablesRes = await axios.get(`${backendUrl}/api/tables`);
      const activeTables = tablesRes.data.filter((t) => t.status !== "EMPTY");
      setTables(activeTables);

      const paidRes = await axios.get(`${backendUrl}/api/orders/paid`);
      const paidOrders = paidRes.data;
      const today = new Date();
      const todayPaidOrders = paidOrders.filter((order) => {
        const paidDate = parseDateValue(
          order.paidAt || order.updatedAt || order.orderTime || order.createdAt
        );
        return paidDate ? isSameLocalDay(paidDate, today) : false;
      });

      let total = 0;
      todayPaidOrders.forEach((order) => {
        let orderTotal = 0;
        if (order.items) {
          order.items.forEach((item) => {
            orderTotal += (item.price || 0) * (item.quantity || item.qty || 0);
          });
        }
        total += orderTotal;
      });

      setDailyTotal(total);
    } catch (err) {
      console.error("Kasaya veri cekilirken hata:", err);
      setError("Veriler yuklenemedi. Baglantiyi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const loadTableOrders = async (tableId) => {
    try {
      const res = await axios.get(`${backendUrl}/api/orders/table/${tableId}`);
      setTableOrders(res.data);
    } catch (err) {
      console.error(`Masa ${tableId} siparisleri alinamadi:`, err);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = new SockJS(backendWsUrl);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        stompClient.subscribe("/topic/tables", (message) => {
          const updatedTables = JSON.parse(message.body);
          setTables(updatedTables.filter((t) => t.status !== "EMPTY"));

          // If selected table was closed from another panel, clear selection.
          setSelectedTable((currentSelected) => {
            if (!currentSelected) return currentSelected;
            const stillActive = updatedTables.find(
              (t) => t.id === currentSelected.id && t.status !== "EMPTY"
            );
            if (!stillActive && !paymentSuccessRef.current) return null;
            return currentSelected;
          });
        });

        stompClient.subscribe("/topic/orders", () => {
          const currentSelected = selectedTableRef.current;
          if (currentSelected) {
            loadTableOrders(currentSelected.id);
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
          total += (item.price || 0) * (item.quantity || item.qty || 0);
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
      fetchData();

      setTimeout(() => {
        setSelectedTable(null);
        setPaymentSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Odeme alinamadi", err);
      setError("Odeme islemi basarisiz oldu.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-slate-900 p-3 text-white sm:p-6 lg:p-8">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="relative z-10 mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
            Kasa Yonetimi
          </h1>
          <p className="mt-1 text-sm text-slate-400 sm:text-base">Odemeler ve gunluk ciro takibi</p>
        </div>

        <div className="flex w-full items-stretch gap-3 sm:w-auto sm:gap-4">
          <div className="flex flex-1 flex-col items-center rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 shadow-lg sm:flex-none sm:px-6">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Gunluk Ciro</span>
            <span className="font-mono text-xl font-black text-emerald-400 sm:text-2xl">TL {dailyTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center justify-center rounded-xl border border-white/10 bg-slate-800 px-4 transition-colors hover:bg-slate-700"
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

      <div className="relative z-10 grid grid-cols-1 gap-4 pb-2 lg:grid-cols-3 lg:gap-8">
        <div className="col-span-1 flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-800/50 p-4 backdrop-blur-md sm:p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <LayoutGrid className="text-emerald-400" />
            <h2 className="text-xl font-bold">Acik Masalar</h2>
            <span className="ml-auto bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
              {tables.length} Masa
            </span>
          </div>

          <div className="max-h-[36vh] flex-1 space-y-3 overflow-y-auto pr-1 sm:max-h-[44vh] lg:max-h-[calc(100vh-360px)] lg:pr-2 custom-scrollbar">
            {tables.length === 0 && !loading && (
              <div className="text-center text-slate-500 py-10">Acik masa bulunmuyor.</div>
            )}

            {[...tables].sort((a, b) => a.id - b.id).map((table) => (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`group flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all duration-300 sm:p-4
                  ${selectedTable?.id === table.id
                    ? "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-slate-900/50 border-white/5 hover:border-emerald-500/30 hover:bg-slate-800"
                  }`}
              >
                <div>
                  <h3 className={`text-lg font-black sm:text-xl ${selectedTable?.id === table.id ? "text-emerald-400" : "text-slate-200"}`}>
                    Masa {table.id}
                  </h3>
                  <span className={`text-xs mt-1 px-2 py-0.5 rounded-md inline-block ${
                    table.status === "CALLING_ROBOT" ? "bg-amber-500/20 text-amber-400 animate-pulse" : "bg-blue-500/20 text-blue-400"
                  }`}>
                    {table.status === "CALLING_ROBOT" ? "Robot Cagrildi" : "Dolu"}
                  </span>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 transition-colors group-hover:bg-emerald-500/20 sm:h-10 sm:w-10">
                  <Banknote size={18} className={selectedTable?.id === table.id ? "text-emerald-400" : "text-slate-400"} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-1 flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-800/50 p-4 backdrop-blur-md sm:p-6 lg:col-span-2">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 mb-6 shadow-inner">
                <Wallet size={40} className="text-slate-600" />
              </div>
              <p className="text-center text-base font-medium sm:text-xl">Hesap kesmek icin soldan masa secin</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white sm:text-3xl">Masa {selectedTable.id} Hesabi</h2>
                  <p className="text-slate-400 text-sm mt-1">{tableOrders.length} aktif siparis</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black tracking-tight text-white font-mono sm:text-4xl">TL {calculateTotal().toFixed(2)}</div>
                </div>
              </div>

              <div className="mb-5 max-h-[45vh] flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-slate-900/50 p-3 custom-scrollbar sm:mb-6 sm:max-h-[50vh] sm:p-4 lg:max-h-[calc(100vh-470px)]">
                {tableOrders.length === 0 ? (
                  <div className="text-center text-slate-500 py-10">Kayitli siparis kalemi bulunamadi.</div>
                ) : (
                  <div className="space-y-4">
                    {tableOrders.map((order) => (
                      <div key={order.id} className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 sm:p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">Siparis #{order.id}</span>
                          <span className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300">{order.status}</span>
                        </div>
                        <ul className="space-y-2 mt-2 border-t border-slate-700/50 pt-3">
                          {order.items?.map((item, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex min-w-0 items-center">
                                <span className="text-emerald-400 font-bold w-6 text-right mr-3">{item.qty || item.quantity}x</span>
                                <span className="truncate text-sm text-slate-200 sm:text-base">{item.name || item.productName}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                                <span className="text-xs text-slate-500">(TL {(item.price || 0).toFixed(2)})</span>
                                <span className="w-16 text-right text-sm font-medium text-white font-mono sm:text-base">
                                  TL {((item.price || 0) * (item.quantity || item.qty || 0)).toFixed(2)}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {paymentSuccess ? (
                  <div className="py-5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center gap-3 text-emerald-400 font-bold text-lg sm:col-span-2 sm:text-xl animate-in fade-in slide-in-from-bottom-2">
                    <CheckCircle2 size={28} /> Odeme basariyla alindi
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handlePayment("CASH")}
                      disabled={isProcessing || tableOrders.length === 0}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:grayscale sm:py-5 sm:text-xl"
                    >
                      <Banknote size={28} />
                      Nakit Odeme Al
                    </button>
                    <button
                      onClick={() => handlePayment("CARD")}
                      disabled={isProcessing || tableOrders.length === 0}
                      className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 py-4 text-lg font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-[0.98] hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:grayscale sm:py-5 sm:text-xl"
                    >
                      <CreditCard size={28} />
                      Kredi Karti
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
