import { Link } from 'react-router-dom';

function AccessHelpPage({ notFound = false }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-10 sm:px-8">
      <div className="w-full rounded-[2rem] border border-cyan-200/25 bg-slate-900/85 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.65)] backdrop-blur sm:p-8">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-300">Robot Kafe Web Sipariş</p>
        <h1 className="mb-2 text-3xl font-black tracking-wide text-white sm:text-4xl">
          {notFound ? 'Geçersiz sayfa' : 'Müşteri sipariş ekranı'}
        </h1>
        <p className="mb-4 max-w-3xl text-sm text-slate-300 sm:text-base">
          Lütfen masa QR kodunu okutun veya test için <code>/menu?table=1</code> adresini kullanın.
        </p>

        <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">QR girişi: `/q/:token`</p>
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">Menü: `/menu?table=4`</p>
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">Durum: `/order/:orderId?table=4`</p>
        </div>

        <Link
          to="/menu?table=1"
          className="mt-6 inline-flex rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Demo menü aç
        </Link>
      </div>
    </main>
  );
}

export default AccessHelpPage;
