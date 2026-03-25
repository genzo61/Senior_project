import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import CategoryTabs from '../components/CategoryTabs';
import ChatPanel from '../components/ChatPanel';
import ProductCard from '../components/ProductCard';
import { createOrder, fetchProducts, fetchTableById } from '../services/customerApi';
import {
  addProductToCart,
  applyStructuredCartItems,
  buildOrderPayload,
  getCartTotal,
  removeCartLine,
  setCartLineNote,
  setCartLineQuantity,
} from '../utils/cartUtils';
import { groupProductsByCategory } from '../utils/menuUtils';
import { formatPrice } from '../utils/textUtils';
import { getStoredTableContext, parseTableFromSearchParams, saveTableContext } from '../utils/tableContext';

const AI_TEASERS = [
  { label: 'Urun onereyim mi?', prompt: 'Bugun ne onerirsin?' },
  { label: 'Hafif secenek bulalim mi?', prompt: 'Hafif bir menu oner' },
  { label: 'Sohbet edip secelim mi?', prompt: 'Konusalim ve secelim' },
];

function RobotDoodle({ variant }) {
  return (
    <div className={`robot-doodle ${variant}`}>
      <span className="robot-doodle__antenna" />
      <span className="robot-doodle__head">
        <span className="robot-doodle__eye robot-doodle__eye--left" />
        <span className="robot-doodle__eye robot-doodle__eye--right" />
        <span className="robot-doodle__mouth" />
      </span>
      <span className="robot-doodle__neck" />
      <span className="robot-doodle__torso" />
    </div>
  );
}

function RobotFaceIcon({ compact = false }) {
  return (
    <span className={`robot-face ${compact ? 'robot-face--compact' : ''}`} aria-hidden="true">
      <span className="robot-face__antenna" />
      <span className="robot-face__head">
        <span className="robot-face__eye robot-face__eye--left" />
        <span className="robot-face__eye robot-face__eye--right" />
        <span className="robot-face__mouth" />
      </span>
    </span>
  );
}

function MenuPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();

  const [tableId, setTableId] = useState(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState('');

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');

  const [activeCategory, setActiveCategory] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefillDraft, setChatPrefillDraft] = useState(null);
  const [teaserIndex, setTeaserIndex] = useState(0);

  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [inlineMessage, setInlineMessage] = useState('');

  const menuMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);
  const categories = useMemo(() => Object.keys(groupedProducts), [groupedProducts]);
  const filteredProducts = activeCategory ? groupedProducts[activeCategory] ?? [] : products;

  const cartLineCount = useMemo(
    () => cartItems.reduce((total, line) => total + Number(line.quantity ?? 0), 0),
    [cartItems],
  );
  const cartTotal = useMemo(() => getCartTotal(cartItems), [cartItems]);

  const activeTeasers = useMemo(
    () => [AI_TEASERS[teaserIndex], AI_TEASERS[(teaserIndex + 1) % AI_TEASERS.length]],
    [teaserIndex],
  );

  useEffect(() => {
    if (!categories.length) {
      return;
    }

    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTeaserIndex((prev) => (prev + 1) % AI_TEASERS.length);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function resolveTableContext() {
      setTableLoading(true);
      const params = new URLSearchParams(searchKey);
      const tableFromQuery = parseTableFromSearchParams(params);
      const stored = getStoredTableContext();
      const candidateTableId = tableFromQuery ?? stored?.tableId ?? 1;

      try {
        const table = await fetchTableById(candidateTableId);

        if (!table) {
          if (isMounted) {
            setTableError(`Masa ${candidateTableId} sistemde bulunamadi.`);
            setTableLoading(false);
          }
          return;
        }

        saveTableContext({ tableId: candidateTableId, source: tableFromQuery ? 'query' : stored?.tableId ? 'session' : 'default' });

        if (!tableFromQuery) {
          setSearchParams({ table: String(candidateTableId) }, { replace: true });
        }

        if (isMounted) {
          setTableId(candidateTableId);
          setTableError('');
          setTableLoading(false);
        }
      } catch {
        if (isMounted) {
          setTableError('Masa bilgisi dogrulanirken sunucuya baglanilamadi.');
          setTableLoading(false);
        }
      }
    }

    resolveTableContext();

    return () => {
      isMounted = false;
    };
  }, [searchKey, setSearchParams]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setProductsLoading(true);
      try {
        const menu = await fetchProducts();
        if (isMounted) {
          setProducts(menu);
          setProductsError('');
        }
      } catch {
        if (isMounted) {
          setProductsError('Menu yuklenemedi. Lutfen daha sonra tekrar deneyin.');
        }
      } finally {
        if (isMounted) {
          setProductsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!inlineMessage) {
      return undefined;
    }

    const timer = setTimeout(() => setInlineMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [inlineMessage]);

  const handleManualAdd = (product) => {
    setCartItems((prev) => addProductToCart(prev, product, { quantity: 1, specialNote: '', source: 'manual' }));
    setInlineMessage(`${product.name} sepete eklendi.`);
  };

  const handleQuickAddProduct = (productCandidate) => {
    const matched = menuMap.get(Number(productCandidate?.id));
    if (!matched) {
      setInlineMessage('Onerilen urun menude bulunamadi.');
      return;
    }

    setCartItems((prev) => addProductToCart(prev, matched, { quantity: 1, specialNote: '', source: 'ai' }));
    setInlineMessage(`${matched.name} sepete eklendi.`);
  };

  const handleAiCartUpdate = (items) => {
    setCartItems((prev) => applyStructuredCartItems(prev, items, menuMap));
    setInlineMessage('AI sepet taslagi guncellendi.');
  };

  const handleCheckout = async () => {
    if (!tableId) {
      setCheckoutError('Masa bilgisi olmadan siparis gonderilemez.');
      return;
    }

    const payload = buildOrderPayload(tableId, cartItems);
    if (!payload.items.length) {
      setCheckoutError('Sepet bos oldugu icin siparis gonderilemedi.');
      return;
    }

    setIsSubmittingOrder(true);
    setCheckoutError('');

    try {
      const order = await createOrder(payload);
      if (!order?.id) {
        throw new Error('Siparis numarasi donmedi');
      }

      navigate(`/order/${order.id}?table=${tableId}`, {
        state: {
          order,
          tableId,
          cartSnapshot: cartItems,
          orderNote,
        },
      });
    } catch {
      setCheckoutError('Siparis gonderilirken hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleTeaserClick = (prompt) => {
    setChatPrefillDraft({ text: prompt, id: Date.now() });
    setChatOpen(true);
  };

  if (tableLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-8">
        <div className="w-full rounded-3xl border border-slate-700 bg-slate-900/90 p-6 text-center">
          <p className="text-sm text-slate-300">Masa bilgisi dogrulaniyor...</p>
        </div>
      </main>
    );
  }

  if (tableError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-8">
        <div className="w-full rounded-3xl border border-rose-500/40 bg-slate-900/95 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-rose-300">Gecersiz masa</p>
          <h1 className="mt-1 text-xl font-bold text-white">Siparis baslatilamadi</h1>
          <p className="mt-2 text-sm text-slate-300">{tableError}</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200">
            Yardim ekranina don
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden overflow-x-hidden pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#020617,#0f172a_58%,#020617)]" />
      <div className="aurora-orb aurora-orb--1" />
      <div className="aurora-orb aurora-orb--2" />
      <div className="aurora-orb aurora-orb--3" />
      <div className="robot-grid-overlay" />
      <div className="robot-scanline" />
      <div className="robot-doodles">
        <RobotDoodle variant="robot-doodle--1" />
        <RobotDoodle variant="robot-doodle--2" />
        <RobotDoodle variant="robot-doodle--3" />
        <RobotDoodle variant="robot-doodle--4" />
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8">
        <header className="mb-5 rounded-3xl border border-cyan-200/25 bg-slate-900/85 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.65)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Robot Kafe Musteri Ekrani</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-wide text-slate-100 sm:text-3xl">Masa {tableId}</h1>
              <p className="text-sm text-slate-300">Web responsive menu, AI asistan ve sepet yonetimi</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="rounded-2xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200"
              >
                AI Garsonu ac
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200"
              >
                Sepet ({cartLineCount})
              </button>
            </div>
          </div>
        </header>

        {inlineMessage ? (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {inlineMessage}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            {productsLoading ? <p className="text-sm text-slate-300">Menu yukleniyor...</p> : null}
            {productsError ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {productsError}
              </p>
            ) : null}

            {!productsLoading && !productsError ? (
              <>
                <CategoryTabs
                  categories={categories}
                  groupedProducts={groupedProducts}
                  activeCategory={activeCategory}
                  onChange={(category) => setActiveCategory(category)}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleManualAdd} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-6 rounded-3xl border border-slate-700/80 bg-slate-900/85 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Canli Ozet</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
                  <p className="text-xs text-slate-400">Kategori</p>
                  <p className="text-sm font-semibold text-slate-100">{activeCategory || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
                  <p className="text-xs text-slate-400">Sepet toplami</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatPrice(cartTotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="w-full rounded-2xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-100"
                >
                  AI ile urun sec
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-100"
                >
                  Sepeti duzenle
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {!chatOpen ? (
        <div className="fixed bottom-40 right-4 z-50 flex w-[220px] flex-col gap-2 sm:right-6">
          {activeTeasers.map((item) => (
            <button
              key={`${item.label}-${item.prompt}`}
              type="button"
              onClick={() => handleTeaserClick(item.prompt)}
              className="rounded-2xl border border-cyan-300/40 bg-slate-900/85 px-3 py-2 text-left text-xs font-semibold text-cyan-100 shadow-[0_8px_28px_rgba(2,6,23,0.55)] transition hover:border-cyan-200"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setChatOpen((prev) => !prev)}
        className="robot-ai-fab ai-fab-pulse fixed bottom-24 right-4 z-50 h-16 w-16 rounded-2xl border border-cyan-200/70 bg-[radial-gradient(circle_at_35%_20%,#67e8f9,#0e7490)] text-sm font-black tracking-widest text-slate-950 transition hover:scale-105 sm:right-6"
        aria-label="AI asistani ac"
      >
        <RobotFaceIcon />
        <span className="sr-only">AI</span>
      </button>

      <div
        className={`fixed inset-0 z-[60] transition ${chatOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <button
          type="button"
          onClick={() => setChatOpen(false)}
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          aria-label="AI panelini kapat"
        />
        <div className="absolute bottom-[6.4rem] left-4 right-4 h-[68vh] sm:left-auto sm:right-6 sm:w-[430px] lg:bottom-6 lg:top-24 lg:h-auto">
          <ChatPanel
            menuItems={products}
            tableId={tableId}
            cartItems={cartItems}
            onApplyCartUpdate={handleAiCartUpdate}
            onQuickAddProduct={handleQuickAddProduct}
            onClose={() => setChatOpen(false)}
            prefillDraft={chatPrefillDraft}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Sepet toplami</p>
            <p className="text-sm font-bold text-emerald-300">{formatPrice(cartTotal)}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/45 bg-cyan-400/15 px-3 py-2 text-sm font-semibold text-cyan-100"
            >
              <RobotFaceIcon compact />
              <span>AI</span>
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Sepeti ac
            </button>
          </div>
        </div>
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        tableId={tableId}
        orderNote={orderNote}
        onOrderNoteChange={setOrderNote}
        onIncrease={(lineId, quantity) => setCartItems((prev) => setCartLineQuantity(prev, lineId, quantity))}
        onDecrease={(lineId, quantity) => setCartItems((prev) => setCartLineQuantity(prev, lineId, quantity))}
        onRemove={(lineId) => setCartItems((prev) => removeCartLine(prev, lineId))}
        onItemNoteChange={(lineId, specialNote) =>
          setCartItems((prev) => setCartLineNote(prev, lineId, specialNote))
        }
        total={cartTotal}
        onCheckout={handleCheckout}
        isSubmitting={isSubmittingOrder}
        checkoutError={checkoutError}
      />
    </main>
  );
}

export default MenuPage;
