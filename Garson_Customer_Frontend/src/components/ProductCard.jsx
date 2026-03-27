import { useMemo, useState } from 'react';
import { formatPrice } from '../utils/textUtils';

function ProductCard({ product, onAdd }) {
  const [imageError, setImageError] = useState(false);

  const fallbackCode = useMemo(
    () =>
      String(product.name ?? 'Ürün')
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase(),
    [product.name],
  );

  return (
    <article className="group overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-900/80 shadow-[0_15px_45px_rgba(2,12,27,0.55)] backdrop-blur">
      <div className="relative h-44 overflow-hidden sm:h-48">
        {!imageError ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#38bdf8_0%,#0f172a_68%)] text-4xl font-black tracking-widest text-cyan-100">
            {fallbackCode}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="rounded-full border border-cyan-300/30 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-cyan-100">
            {product.category}
          </span>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-100">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-bold tracking-wide text-slate-100">{product.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300/90">{product.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {product.tags.slice(0, 3).map((tag) => (
            <span
              key={`${product.id}-${tag}`}
              className="rounded-full border border-slate-600/70 bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-slate-200"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          disabled={!product.available}
          onClick={() => onAdd(product)}
          className={`w-full rounded-2xl px-4 py-2.5 text-sm font-bold tracking-wide transition ${
            product.available
              ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              : 'cursor-not-allowed bg-slate-700 text-slate-400'
          }`}
        >
          {product.available ? 'Sepete ekle' : 'Stokta yok'}
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
