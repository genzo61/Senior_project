import { useEffect, useMemo, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import OrderCard from "./OrderCard";
import { backendBaseUrl, backendWsUrl } from "../config/backendUrl";

function OrdersDashboard() {
  const [allOrders, setAllOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("NEW");
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const displayedOrders = useMemo(
    () => allOrders.filter((order) => order.status === activeTab),
    [allOrders, activeTab]
  );

  const stats = useMemo(() => {
    const newCount = allOrders.filter((order) => order.status === "NEW").length;
    const readyCount = allOrders.filter((order) => order.status === "READY").length;
    const activeTableCount = new Set(
      allOrders
        .map((order) => String(order.tableNo || "").trim())
        .filter((tableNo) => tableNo.length > 0)
    ).size;

    return { newCount, readyCount, activeTableCount };
  }, [allOrders]);

  const upsertOrder = (prevOrders, order) => {
    const exists = prevOrders.find((existing) => existing.id === order.id);

    if (!exists && order.status === "NEW") {
      const audio = new Audio("/bell.mp3");
      audio.play().catch((playError) => console.log("Audio ignored:", playError));
    }

    if (exists) {
      return prevOrders
        .map((existing) => (existing.id === order.id ? order : existing))
        .sort((left, right) => right.id - left.id);
    }

    return [order, ...prevOrders].sort((left, right) => right.id - left.id);
  };

  useEffect(() => {
    let isMounted = true;

    fetch(`${backendBaseUrl}/api/orders`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setAllOrders(data.sort((left, right) => right.id - left.id));
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        console.error("Siparisler cekilemedi:", fetchError);
        setError("Baglanti hatasi: Mutfak verileri guncellenemiyor.");
      });

    const client = new Client({
      webSocketFactory: () => new SockJS(backendWsUrl),
      onConnect: () => {
        client.subscribe("/topic/orders", (message) => {
          if (!message.body || !isMounted) return;

          try {
            const payload = JSON.parse(message.body);

            if (Array.isArray(payload)) {
              const activeOrders = payload
                .filter((order) => order.status !== "PAID")
                .sort((left, right) => right.id - left.id);
              setAllOrders(activeOrders);
              return;
            }

            setAllOrders((prevOrders) => upsertOrder(prevOrders, payload));
          } catch (parseError) {
            console.error("Orders WS payload parse error:", parseError);
          }
        });
      },
      onStompError: (frame) => {
        console.error("Broker error:", frame.headers.message);
      },
    });

    client.activate();

    return () => {
      isMounted = false;
      client.deactivate();
    };
  }, []);

  const handleFinishOrder = async (orderId, nextStatus) => {
    if (!nextStatus) return;

    setUpdatingOrderId(orderId);
    try {
      const response = await fetch(`${backendBaseUrl}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (response.ok || response.status === 204) {
        setAllOrders((prevOrders) =>
          nextStatus === "DELIVERED"
            ? prevOrders.filter((order) => order.id !== orderId)
            : prevOrders.map((order) =>
                order.id === orderId ? { ...order, status: nextStatus } : order
              )
        );
        return;
      }

      const errorMsg = await response.text();
      if (
        response.status === 400 &&
        (errorMsg.toLowerCase().includes("stok") ||
          errorMsg.toLowerCase().includes("stock") ||
          errorMsg.toLowerCase().includes("insufficient"))
      ) {
        alert("Stok yetersiz: Siparis hazir olarak isaretlenemedi.");
      } else if (response.status === 409) {
        alert(`Siparis zaten ${nextStatus} veya gecis gecersiz.`);
      } else {
        alert(`Hata: ${errorMsg || "Status guncellenemedi."}`);
      }
    } catch (updateError) {
      console.error("Guncelleme hatasi:", updateError);
      alert("Sunucuya baglanilamadi.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-76px)] overflow-hidden pb-6 sm:min-h-[calc(100vh-86px)] sm:pb-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#020617,#0f172a_58%,#020617)]" />
      <div className="aurora-orb aurora-orb--1" />
      <div className="aurora-orb aurora-orb--2" />
      <div className="aurora-orb aurora-orb--3" />
      <div className="robot-grid-overlay" />
      <div className="robot-scanline" />

      <section className="relative mx-auto w-full max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <header className="mb-4 rounded-3xl border border-cyan-200/25 bg-slate-900/85 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.65)] backdrop-blur sm:mb-5 sm:p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Robot Kafe Mutfak Ekrani</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-wide text-slate-100 sm:text-3xl">Canli Siparis Akisi</h1>
              <p className="text-xs text-slate-300 sm:text-sm">Yeni gelen siparisleri hazirla, bekleyenleri teslim et.</p>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[220px]">
              <div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200">Yeni</p>
                <p className="text-lg font-black text-cyan-100 sm:text-xl">{stats.newCount}</p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Hazir</p>
                <p className="text-lg font-black text-amber-100 sm:text-xl">{stats.readyCount}</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">Masa</p>
                <p className="text-lg font-black text-emerald-100 sm:text-xl">{stats.activeTableCount}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-4 flex w-full items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70 p-2 backdrop-blur sm:mb-5 sm:flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("NEW")}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:px-5 ${
              activeTab === "NEW"
                ? "border border-rose-300/60 bg-rose-400/20 text-rose-100"
                : "border border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/70"
            }`}
          >
            Yeni Siparisler ({stats.newCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("READY")}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:px-5 ${
              activeTab === "READY"
                ? "border border-amber-300/60 bg-amber-400/20 text-amber-100"
                : "border border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/70"
            }`}
          >
            Hazir Bekleyen ({stats.readyCount})
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {displayedOrders.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Durum</p>
              <h2 className="mt-2 text-2xl font-black text-slate-100">
                {activeTab === "NEW" ? "Yeni siparis yok" : "Hazir bekleyen siparis yok"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {activeTab === "NEW"
                  ? "Mutfaga yeni siparis dusunce kartlar otomatik gorunecek."
                  : "Hazir kartlari teslim ettikce liste temizlenir."}
              </p>
            </div>
          ) : (
            displayedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={handleFinishOrder}
                nextStatus={activeTab === "NEW" ? "READY" : "DELIVERED"}
                isLoading={updatingOrderId === order.id}
              />
            ))
          )}
        </section>
      </section>
    </main>
  );
}

export default OrdersDashboard;
