import { useMemo, useState } from 'react';
import { sendAssistantMessage } from '../services/aiService';
import { formatPrice } from '../utils/textUtils';

function ChatMessage({ message, onQuickAdd }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`rounded-xl border px-3 py-2 ${isAssistant ? 'border-slate-700 bg-slate-900' : 'border-amber-400/40 bg-amber-500/10'}`}>
      <p className={`text-sm leading-relaxed ${isAssistant ? 'text-slate-100' : 'text-amber-100'}`}>{message.text}</p>

      {isAssistant && Array.isArray(message.suggestedProducts) && message.suggestedProducts.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {message.suggestedProducts.map((product) => (
            <button
              key={`suggestion-${product.id}`}
              type="button"
              onClick={() => onQuickAdd(product)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left transition hover:border-emerald-400"
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

function ChatPanel({ menuItems, tableId, cartItems, onApplyCartUpdate, onQuickAddProduct }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Menu asistanina hos geldiniz. Urun onerisi isteyebilir veya sepete ekleme yazabilirsiniz.',
      suggestedProducts: [],
    },
  ]);

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
        text:
          response.source === 'mock'
            ? `${response.assistant_message} (mock parser)`
            : response.assistant_message,
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
    <section className="flex h-[65vh] flex-col rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        AI sadece menudeki urunleri onerir ve sepete taslak guncelleme yapar. Siparis sadece siz onaylayinca gonderilir.
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
          placeholder="Orn: bir kola ekle"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            isLoading ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
          }`}
        >
          {isLoading ? 'Bekleyin...' : 'Gonder'}
        </button>
      </form>
    </section>
  );
}

export default ChatPanel;
