function CategoryTabs({ categories, activeCategory, onChange }) {
  if (!categories.length) {
    return null;
  }

  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeCategory === category
              ? 'border-amber-400 bg-amber-400 text-slate-900'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

export default CategoryTabs;
