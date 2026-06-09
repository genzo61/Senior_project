import { useEffect, useMemo, useState } from 'react';
import { sendAssistantMessage } from '../services/aiService';
import { formatPrice, normalizeText } from '../utils/textUtils';

const QUICK_PROMPTS = ['Bugün ne önerirsin?', 'Hafif bir menü öner', '2 kola sepete ekle'];

function ChatMessage({ message, onQuickAdd }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        isAssistant ? 'border-cyan-200/20 bg-slate-900/80' : 'border-fuchsia-300/35 bg-fuchsia-400/10'
      }`}
    >
      <p className={`text-sm leading-relaxed ${isAssistant ? 'text-slate-100' : 'text-fuchsia-50'}`}>{message.text}</p>

      {isAssistant && Array.isArray(message.suggestedProducts) && message.suggestedProducts.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {message.suggestedProducts.map((product) => (
            <button
              key={`suggestion-${product.id}`}
              type="button"
              onClick={() => onQuickAdd(product)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-left transition hover:border-cyan-300/70"
            >
              <p className="text-sm font-semibold text-slate-100">{product.name}</p>
              <p className="text-xs text-slate-400">{formatPrice(product.price)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatPanel({ menuItems, tableNo, cartItems, onApplyCartUpdate, onQuickAddProduct, onClose, prefillDraft }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Robot asistan buradayım. Ürün önerisi isteyebilir veya sepete ürün ekletebilirsiniz.',
      suggestedProducts: [],
    },
  ]);

  useEffect(() => {
    if (!prefillDraft?.text) {
      return;
    }
    setInput(prefillDraft.text);
  }, [prefillDraft]);

  const menuMap = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);
  const menuNameMap = useMemo(
    () => new Map(menuItems.map((item) => [normalizeText(item.name), item])),
    [menuItems],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      suggestedProducts: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendAssistantMessage({
        message: trimmed,
        menuItems,
        tableNo,
        cartItems,
      });

      if (response.intent === 'cart_update' && response.items.length > 0) {
        onApplyCartUpdate(response.items);
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response.assistant_message,
        suggestedProducts: (response.suggested_products ?? [])
          .map((row) => {
            const byId = menuMap.get(Number(row.id));
            if (byId) {
              return byId;
            }

            const byName = menuNameMap.get(normalizeText(row.name));
            if (byName) {
              return byName;
            }

            return row;
          })
          .filter(Boolean),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: 'Asistan yanıtı alınamadı. Lütfen tekrar deneyin.',
          suggestedProducts: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col border-y border-cyan-200/20 bg-slate-950/95 p-3 backdrop-blur-xl sm:rounded-3xl sm:border sm:p-4 sm:shadow-[0_25px_70px_rgba(2,8,23,0.75)]">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">AI Garson</p>
          <p className="text-sm text-slate-400">Masa {tableNo}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/60"
        >
          Kapat
        </button>
      </div>

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/70"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onQuickAdd={onQuickAddProduct} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Örn: bir lahmacun ekle"
          className="min-h-11 w-full flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-300/80 sm:text-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`min-h-11 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold sm:w-auto ${
            isLoading ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
          }`}
        >
          {isLoading ? 'Bekleyin...' : 'Gönder'}
        </button>
      </form>
    </section>
  );
}

export default ChatPanel;
