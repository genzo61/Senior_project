import { useRef } from 'react';

function CategoryTabs({ categories, activeCategory, onChange, groupedProducts = {} }) {
  const scrollRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartScrollLeftRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

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

  const handleCategoryClick = (event, category) => {
    if (isTouchDraggingRef.current) {
      event.preventDefault();
      return;
    }
    onChange(category);
  };

  const handleTouchStart = (event) => {
    const container = scrollRef.current;
    if (!container || event.touches.length !== 1) return;

    touchStartXRef.current = event.touches[0].clientX;
    touchStartScrollLeftRef.current = container.scrollLeft;
    isTouchDraggingRef.current = false;
  };

  const handleTouchMove = (event) => {
    const container = scrollRef.current;
    if (!container || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 5) {
      isTouchDraggingRef.current = true;
    }

    container.scrollLeft = touchStartScrollLeftRef.current - deltaX;
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isTouchDraggingRef.current = false;
    }, 0);
  };

  return (
    <div className="relative">
      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:hidden">Kategorileri kaydir</p>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="no-scrollbar mb-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-2 pr-1 scroll-smooth [overscroll-behavior-x:contain] [touch-action:pan-x] [-webkit-overflow-scrolling:touch] sm:mb-4 sm:gap-2 sm:pr-0"
      >
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={(event) => handleCategoryClick(event, category)}
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
    </div>
  );
}

export default CategoryTabs;
