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
    <article className="group overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-900/80 shadow-[0_10px_24px_rgba(2,12,27,0.4)] backdrop-blur sm:rounded-3xl sm:shadow-[0_15px_45px_rgba(2,12,27,0.55)]">
      <div className="relative h-24 overflow-hidden sm:h-48">
        {!imageError ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#38bdf8_0%,#0f172a_68%)] text-xl font-black tracking-widest text-cyan-100 sm:text-4xl">
            {fallbackCode}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 sm:bottom-3 sm:left-3 sm:right-3 sm:gap-2">
          <span className="rounded-full border border-cyan-300/30 bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100 sm:px-3 sm:py-1 sm:text-[11px]">
            {product.category}
          </span>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100 sm:px-3 sm:py-1 sm:text-sm">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 p-2.5 sm:space-y-3 sm:p-4">
        <div>
          <h3 className="text-[13px] font-bold tracking-wide text-slate-100 sm:text-lg">{product.name}</h3>
          <p className="mt-0.5 overflow-hidden text-[10px] leading-3.5 text-slate-300/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-1 sm:text-sm sm:leading-relaxed sm:[-webkit-line-clamp:3]">
            {product.description}
          </p>
        </div>

        <div className="hidden flex-wrap gap-2 sm:flex">
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
          className={`w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm ${
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
