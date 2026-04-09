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
import {
  buildNormalizedTableSearchParams,
  getStoredTableContext,
  resolveTableNoFromSearchParams,
  saveTableContext,
} from '../utils/tableContext';

const AI_TEASERS = [
  { label: 'Ürün önereyim mi?', prompt: 'Bugün ne önerirsin?' },
  { label: 'Hafif seçenek bulalım mı?', prompt: 'Hafif bir menü öner' },
  { label: 'Sohbet edip seçelim mi?', prompt: 'Konuşalım ve seçelim' },
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

  const [tableNo, setTableNo] = useState(null);
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
      const { tableNo: tableFromQuery, hasQueryParam, shouldNormalize } = resolveTableNoFromSearchParams(params);
      if (hasQueryParam && tableFromQuery === null) {
        if (isMounted) {
          setTableError('Masa parametresi geçersiz.');
          setTableLoading(false);
        }
        return;
      }

      const stored = getStoredTableContext();
      const candidateTableNo = tableFromQuery ?? stored?.tableNo ?? 1;

      try {
        const table = await fetchTableById(candidateTableNo);

        if (!table) {
          if (isMounted) {
            setTableError(`Masa ${candidateTableNo} sistemde bulunamadı.`);
            setTableLoading(false);
          }
          return;
        }

        saveTableContext({
          tableNo: candidateTableNo,
          source: tableFromQuery ? 'query' : stored?.tableNo ? 'session' : 'default',
        });

        if (shouldNormalize || !params.get('tableNo')) {
          const normalizedParams = buildNormalizedTableSearchParams(params, candidateTableNo);
          if (normalizedParams) {
            setSearchParams(normalizedParams, { replace: true });
          }
        }

        if (isMounted) {
          setTableNo(candidateTableNo);
          setTableError('');
          setTableLoading(false);
        }
      } catch {
        if (isMounted) {
          setTableError('Masa bilgisi doğrulanırken sunucuya bağlanılamadı.');
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
          setProductsError('Menü yüklenemedi. Lütfen daha sonra tekrar deneyin.');
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
      setInlineMessage('Önerilen ürün menüde bulunamadı.');
      return;
    }

    setCartItems((prev) => addProductToCart(prev, matched, { quantity: 1, specialNote: '', source: 'ai' }));
    setInlineMessage(`${matched.name} sepete eklendi.`);
  };

  const handleAiCartUpdate = (items) => {
    setCartItems((prev) => applyStructuredCartItems(prev, items, menuMap));
    setInlineMessage('AI sepet taslağı güncellendi.');
  };

  const handleCheckout = async () => {
    if (!tableNo) {
      setCheckoutError('Masa bilgisi olmadan sipariş gönderilemez.');
      return;
    }

    const payload = buildOrderPayload(tableNo, cartItems);
    if (!payload.items.length) {
      setCheckoutError('Sepet boş olduğu için sipariş gönderilemedi.');
      return;
    }

    setIsSubmittingOrder(true);
    setCheckoutError('');

    try {
      const order = await createOrder(payload);
      if (!order?.id) {
        throw new Error('Sipariş numarası dönmedi');
      }

      navigate(`/order/${order.id}?tableNo=${tableNo}`, {
        state: {
          order,
          tableNo,
          cartSnapshot: cartItems,
          orderNote,
        },
      });
    } catch {
      setCheckoutError('Sipariş gönderilirken hata oluştu. Lütfen tekrar deneyin.');
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
          <p className="text-sm text-slate-300">Masa bilgisi doğrulanıyor...</p>
        </div>
      </main>
    );
  }

  if (tableError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-8">
        <div className="w-full rounded-3xl border border-rose-500/40 bg-slate-900/95 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-rose-300">Geçersiz masa</p>
          <h1 className="mt-1 text-xl font-bold text-white">Sipariş başlatılamadı</h1>
          <p className="mt-2 text-sm text-slate-300">{tableError}</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200">
            Yardım ekranına dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden overflow-x-hidden pb-36 sm:pb-28">
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
        <header className="mb-5 rounded-3xl border border-cyan-200/25 bg-slate-900/85 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.65)] backdrop-blur sm:p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Robot Kafe Müşteri Ekranı</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black tracking-wide text-slate-100 sm:text-3xl">Masa {tableNo}</h1>
              <p className="text-xs text-slate-300 sm:text-sm">Web responsive menü, AI asistan ve sepet yönetimi</p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="w-full rounded-2xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 sm:w-auto"
              >
                AI Garsonu aç
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 sm:w-auto"
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

        <section className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            {productsLoading ? <p className="text-sm text-slate-300">Menü yükleniyor...</p> : null}
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

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-3 [&>*]:min-w-0">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={handleManualAdd} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-6 rounded-3xl border border-slate-700/80 bg-slate-900/85 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Canlı Özet</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
                  <p className="text-xs text-slate-400">Kategori</p>
                  <p className="text-sm font-semibold text-slate-100">{activeCategory || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
                  <p className="text-xs text-slate-400">Sepet toplamı</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatPrice(cartTotal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="w-full rounded-2xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-100"
                >
                  AI ile ürün seç
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-100"
                >
                  Sepeti düzenle
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {!chatOpen ? (
        <div className="fixed bottom-44 right-6 z-50 hidden w-[220px] flex-col gap-2 sm:flex">
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
        className="robot-ai-fab ai-fab-pulse fixed bottom-[7.15rem] right-4 z-50 h-14 w-14 rounded-2xl border border-cyan-200/70 bg-[radial-gradient(circle_at_35%_20%,#67e8f9,#0e7490)] text-sm font-black tracking-widest text-slate-950 transition hover:scale-105 sm:bottom-24 sm:right-6 sm:h-16 sm:w-16"
        aria-label="AI asistanı aç"
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
        <div className="absolute bottom-[7rem] left-3 right-3 h-[70vh] max-h-[600px] sm:left-auto sm:right-6 sm:w-[430px] lg:bottom-6 lg:top-24 lg:h-auto">
          <ChatPanel
            menuItems={products}
            tableNo={tableNo}
            cartItems={cartItems}
            onApplyCartUpdate={handleAiCartUpdate}
            onQuickAddProduct={handleQuickAddProduct}
            onClose={() => setChatOpen(false)}
            prefillDraft={chatPrefillDraft}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-400">Sepet toplamı</p>
            <p className="text-sm font-bold text-emerald-300">{formatPrice(cartTotal)}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/45 bg-cyan-400/15 px-3 py-2 text-sm font-semibold text-cyan-100 sm:flex-none"
            >
              <RobotFaceIcon compact />
              <span>AI</span>
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex-1 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 sm:flex-none"
            >
              Sepeti aç
            </button>
          </div>
        </div>
      </div>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        tableNo={tableNo}
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
