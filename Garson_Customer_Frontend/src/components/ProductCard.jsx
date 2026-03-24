import { formatPrice } from '../utils/textUtils';

function ProductCard({ product, onAdd }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{product.name}</h3>
        <span className="text-sm font-bold text-emerald-300">{formatPrice(product.price)}</span>
      </div>

      <p className="mb-3 text-sm text-slate-400">{product.description}</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {product.tags.map((tag) => (
          <span
            key={`${product.id}-${tag}`}
            className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        type="button"
        disabled={!product.available}
        onClick={() => onAdd(product)}
        className={`w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
          product.available
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            : 'cursor-not-allowed bg-slate-800 text-slate-500'
        }`}
      >
        {product.available ? 'Sepete ekle' : 'Stokta yok'}
      </button>
    </article>
  );
}

export default ProductCard;
