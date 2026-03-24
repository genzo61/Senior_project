import { Link } from 'react-router-dom';

function AccessHelpPage({ notFound = false }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <p className="mb-2 text-xs uppercase tracking-wider text-amber-300">QR Mobil Siparis</p>
        <h1 className="mb-2 text-2xl font-bold text-white">
          {notFound ? 'Gecersiz sayfa' : 'Musteri siparis ekrani'}
        </h1>
        <p className="mb-4 text-sm text-slate-300">
          Lutfen masa QR kodunu okutun veya test icin `/menu?table=1` adresini kullanin.
        </p>

        <div className="space-y-2 text-xs text-slate-400">
          <p>- QR girisi: `/q/:token`</p>
          <p>- Menu girisi: `/menu?table=4`</p>
          <p>- Durum ekrani: `/order/:orderId?table=4`</p>
        </div>

        <Link
          to="/menu?table=1"
          className="mt-5 inline-flex rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Demo menu ac
        </Link>
      </div>
    </main>
  );
}

export default AccessHelpPage;
