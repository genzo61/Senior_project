function CategoryTabs({ categories, activeCategory, onChange, groupedProducts = {} }) {
  if (!categories.length) {
    return null;
  }

  return (
    <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeCategory === category
              ? 'border-cyan-300 bg-cyan-300 text-slate-950'
              : 'border-slate-600 bg-slate-900/80 text-slate-200 hover:border-cyan-400/60'
          }`}
        >
          <span>{category}</span>
          <span className="ml-2 rounded-full bg-slate-950/25 px-2 py-0.5 text-xs">
            {groupedProducts[category]?.length ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

export default CategoryTabs;
