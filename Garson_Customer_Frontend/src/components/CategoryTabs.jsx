import { useRef } from 'react';

function CategoryTabs({ categories, activeCategory, onChange, groupedProducts = {} }) {
  const scrollRef = useRef(null);

  if (!categories.length) {
    return null;
  }

  const handleWheel = (event) => {
    const container = scrollRef.current;
    if (!container) return;

    if (container.scrollWidth > container.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    }
  };

  const handleCategoryClick = (category) => {
    onChange(category);
  };

  return (
    <div className="relative">
      <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:hidden">Kategorileri kaydır</p>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="no-scrollbar -mx-2 mb-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-2 pb-2 scroll-smooth [overscroll-behavior-x:contain] [touch-action:pan-x] [-webkit-overflow-scrolling:touch] sm:mx-0 sm:mb-4 sm:gap-2 sm:px-0"
      >
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => handleCategoryClick(category)}
            className={`snap-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
              activeCategory === category
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-600 bg-slate-900/80 text-slate-200 hover:border-cyan-400/60'
            }`}
          >
            <span>{category}</span>
            <span className="ml-1.5 rounded-full bg-slate-950/25 px-1.5 py-0.5 text-[10px] sm:ml-2 sm:px-2 sm:text-xs">
              {groupedProducts[category]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-0 top-0 w-6 bg-gradient-to-r from-slate-950/85 to-transparent sm:hidden" />
      <div className="pointer-events-none absolute bottom-2 right-0 top-0 w-6 bg-gradient-to-l from-slate-950/85 to-transparent sm:hidden" />
    </div>
  );
}

export default CategoryTabs;
