import { Link } from 'react-router-dom';

function AccessHelpPage({ notFound = false }) {
  return (
    <main className="safe-screen-min mx-auto flex w-full max-w-5xl items-center px-4 py-8 sm:px-8 sm:py-10">
      <div className="w-full rounded-[2rem] border border-cyan-200/25 bg-slate-900/85 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.65)] backdrop-blur sm:p-8">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-300">Robot Kafe Web Siparis</p>
        <h1 className="mb-2 text-2xl font-black tracking-wide text-white sm:text-4xl">
          {notFound ? 'Gecersiz sayfa' : 'Musteri siparis ekrani'}
        </h1>
        <p className="mb-4 max-w-3xl text-sm text-slate-300 sm:text-base">
          Lutfen masa QR kodunu okutun veya test icin <code>/menu?tableNo=1</code> adresini kullanin.
        </p>

        <div className="grid gap-2 text-sm text-slate-300 lg:grid-cols-3">
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">QR girisi: `/q/:token`</p>
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">Menu: `/menu?tableNo=4`</p>
          <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">Durum: `/order/:orderId?tableNo=4`</p>
        </div>

        <Link
          to="/menu?tableNo=1"
          className="mt-6 inline-flex w-full justify-center rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 sm:w-auto"
        >
          Demo menu ac
        </Link>
      </div>
    </main>
  );
}

export default AccessHelpPage;
