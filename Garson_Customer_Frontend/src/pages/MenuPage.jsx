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
  getStoredTableContext,
  parseTableFromSearchParams,
  saveTableContext,
} from '../utils/tableContext';

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

  const [activePanel, setActivePanel] = useState('menu');
  const [activeCategory, setActiveCategory] = useState('');

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

  useEffect(() => {
    if (!categories.length) {
      return;
    }

    if (!activeCategory || !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    let isMounted = true;

    async function resolveTableContext() {
      setTableLoading(true);
      const params = new URLSearchParams(searchKey);
      const tableFromQuery = parseTableFromSearchParams(params);
      const stored = getStoredTableContext();
      const candidateTableId = tableFromQuery ?? stored?.tableId ?? null;

      if (!candidateTableId) {
        if (isMounted) {
          setTableLoading(false);
          setTableError('Masa bilgisi bulunamadi. Lutfen QR kodunu tekrar okutun.');
        }
        return;
      }

      try {
        const table = await fetchTableById(candidateTableId);

        if (!table) {
          if (isMounted) {
            setTableError(`Masa ${candidateTableId} sistemde bulunamadi.`);
            setTableLoading(false);
          }
          return;
        }

        saveTableContext({ tableId: candidateTableId, source: tableFromQuery ? 'query' : 'session' });

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

  if (tableLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-8">
        <div className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-sm text-slate-300">Masa bilgisi dogrulaniyor...</p>
        </div>
      </main>
    );
  }

  if (tableError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-8">
        <div className="w-full rounded-3xl border border-rose-500/40 bg-slate-900 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-rose-300">Gecersiz masa</p>
          <h1 className="mt-1 text-xl font-bold text-white">Siparis baslatilamadi</h1>
          <p className="mt-2 text-sm text-slate-300">{tableError}</p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Yardim ekranina don
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
      <header className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">Mobil Musteri Siparis</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Masa {tableId}</h1>
            <p className="text-xs text-slate-400">AI destekli menu ve sepet</p>
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200"
          >
            Sepet ({cartLineCount})
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActivePanel('menu')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              activePanel === 'menu'
                ? 'bg-amber-400 text-slate-950'
                : 'border border-slate-700 bg-slate-950 text-slate-200'
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => setActivePanel('chat')}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              activePanel === 'chat'
                ? 'bg-amber-400 text-slate-950'
                : 'border border-slate-700 bg-slate-950 text-slate-200'
            }`}
          >
            AI Sohbet
          </button>
        </div>
      </header>

      {inlineMessage ? (
        <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {inlineMessage}
        </div>
      ) : null}

      {activePanel === 'menu' ? (
        <section>
          {productsLoading ? <p className="text-sm text-slate-400">Menu yukleniyor...</p> : null}
          {productsError ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {productsError}
            </p>
          ) : null}

          {!productsLoading && !productsError ? (
            <>
              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onChange={(category) => setActiveCategory(category)}
              />

              <div className="grid gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={handleManualAdd} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activePanel === 'chat' ? (
        <ChatPanel
          menuItems={products}
          tableId={tableId}
          cartItems={cartItems}
          onApplyCartUpdate={handleAiCartUpdate}
          onQuickAddProduct={handleQuickAddProduct}
        />
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Sepet toplami</p>
            <p className="text-sm font-bold text-emerald-300">{formatPrice(cartTotal)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Sepeti ac
          </button>
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
