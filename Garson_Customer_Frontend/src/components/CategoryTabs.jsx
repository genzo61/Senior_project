function CategoryTabs({ categories, activeCategory, onChange, groupedProducts = {} }) {
  if (!categories.length) {
    return null;
  }

  return (
    <div className="mb-3 sm:mb-4">
      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:hidden">Kategorileri kaydir</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 [overscroll-behavior-x:contain] [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
              activeCategory === category
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-600 bg-slate-900/80 text-slate-200 hover:border-cyan-400/60'
            } min-w-[108px] text-center sm:min-w-0`}
          >
            <span>{category}</span>
            <span className="ml-1.5 rounded-full bg-slate-950/25 px-1.5 py-0.5 text-[10px] sm:ml-2 sm:px-2 sm:text-xs">
              {groupedProducts[category]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CategoryTabs;
