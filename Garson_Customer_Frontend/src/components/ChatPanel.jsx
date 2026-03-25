import { useEffect, useMemo, useState } from 'react';
import { sendAssistantMessage } from '../services/aiService';
import { formatPrice } from '../utils/textUtils';

const QUICK_PROMPTS = ['Bugun ne onerirsin?', 'Hafif bir menu oner', '2 kola sepete ekle'];

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

function ChatPanel({ menuItems, tableId, cartItems, onApplyCartUpdate, onQuickAddProduct, onClose, prefillDraft }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Robot asistan buradayim. Urun onerisi isteyebilir veya sepete urun ekletebilirsiniz.',
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
        tableId,
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
          .map((row) => menuMap.get(Number(row.id)) ?? row)
          .filter(Boolean),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: 'Asistan yaniti alinamadi. Lutfen tekrar deneyin.',
          suggestedProducts: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-full flex-col rounded-3xl border border-cyan-200/20 bg-slate-950/95 p-3 shadow-[0_25px_70px_rgba(2,8,23,0.75)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">AI Garson</p>
          <p className="text-sm text-slate-400">Masa {tableId}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/60"
        >
          Kapat
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/70"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onQuickAdd={onQuickAddProduct} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-800 pt-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Orn: bir lahmacun ekle"
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/80"
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
            isLoading ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
          }`}
        >
          {isLoading ? 'Bekleyin...' : 'Gonder'}
        </button>
      </form>
    </section>
  );
}

export default ChatPanel;
