import axios from 'axios';
import { getAiEndpoint } from './apiClient';
import { includesPhrase, normalizeText, toSentenceCase } from '../utils/textUtils';

const NUMBER_WORDS = {
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  alti: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
};

const CART_ADD_WORDS = ['ekle', 'olsun', 'isterim', 'istiyorum', 'alalim', 'almak'];
const CART_REMOVE_WORDS = ['cikar', 'sil', 'istemiyorum', 'olmasin'];
const MENU_ASSISTANT_WORDS = ['oner', 'onerir', 'ne var', 'hafif', 'yanina', 'acisiz', 'tatli', 'tavuk'];

const NOTE_PATTERNS = [
  { token: 'acili', note: 'Acili olsun' },
  { token: 'sogansiz', note: 'Sogansiz' },
  { token: 'sekersiz', note: 'Sekersiz' },
  { token: 'az tuzlu', note: 'Az tuzlu' },
  { token: 'tuzsuz', note: 'Tuzsuz' },
  { token: 'az pis', note: 'Az pisirilsin' },
  { token: 'iyi pismis', note: 'Iyi pismis olsun' },
];

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quantityFromToken(token) {
  if (!token) {
    return 1;
  }

  const normalized = normalizeText(token);
  if (!normalized) {
    return 1;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  return NUMBER_WORDS[normalized] ?? 1;
}

function extractSpecialNote(normalizedMessage) {
  const notes = NOTE_PATTERNS.filter((pattern) => includesPhrase(normalizedMessage, pattern.token)).map(
    (pattern) => pattern.note,
  );

  const butMatch = normalizedMessage.match(/\bama\s+(.+)$/);
  if (butMatch?.[1]) {
    const tail = butMatch[1].trim();
    if (tail && tail.length <= 40) {
      notes.push(toSentenceCase(tail));
    }
  }

  return Array.from(new Set(notes)).join(', ');
}

function buildAliases(productName) {
  const normalizedName = normalizeText(productName);
  const aliases = new Set([normalizedName]);

  normalizedName
    .split(' ')
    .filter((token) => token.length >= 3)
    .forEach((token) => aliases.add(token));

  if (includesPhrase(normalizedName, 'hamburger')) {
    aliases.add('burger');
  }

  if (includesPhrase(normalizedName, 'patates')) {
    aliases.add('fries');
  }

  if (includesPhrase(normalizedName, 'kahve')) {
    aliases.add('coffee');
  }

  return Array.from(aliases);
}

function messageHasAny(normalizedMessage, wordList) {
  return wordList.some((token) => includesPhrase(normalizedMessage, token));
}

function parseQuantityForAlias(normalizedMessage, alias) {
  const pattern = new RegExp(
    `(?:^|\\s)(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(?:\\s+adet|\\s+tane)?\\s+${escapeRegExp(alias)}(?:\\s|$)`,
  );

  const match = normalizedMessage.match(pattern);
  if (match?.[1]) {
    return Math.min(quantityFromToken(match[1]), 99);
  }

  return 1;
}

function matchProductsFromMessage(normalizedMessage, menuItems) {
  const matches = [];

  menuItems.forEach((product) => {
    const aliases = buildAliases(product.name);
    const matchedAlias = aliases.find((alias) => {
      if (alias.length < 3 && alias !== 'su') {
        return false;
      }
      return includesPhrase(normalizedMessage, alias);
    });

    if (!matchedAlias) {
      return;
    }

    matches.push({
      product,
      alias: matchedAlias,
      quantity: parseQuantityForAlias(normalizedMessage, matchedAlias),
    });
  });

  return matches;
}

function buildMenuSuggestions(normalizedMessage, menuItems) {
  const inStock = menuItems.filter((item) => item.available);

  if (includesPhrase(normalizedMessage, 'sutlu') || includesPhrase(normalizedMessage, 'tatli')) {
    return inStock.filter((item) => item.tags.includes('sutlu tatli')).slice(0, 4);
  }

  if (includesPhrase(normalizedMessage, 'hafif')) {
    return inStock
      .filter((item) => ['Salata', 'Tatli', 'Icecek'].includes(item.category))
      .slice(0, 4);
  }

  if (includesPhrase(normalizedMessage, 'tavuk')) {
    return inStock.filter((item) => includesPhrase(normalizeText(item.name), 'tavuk')).slice(0, 4);
  }

  if (includesPhrase(normalizedMessage, 'acisiz')) {
    return inStock.filter((item) => item.tags.includes('acisiz')).slice(0, 4);
  }

  return inStock.slice(0, 4);
}

function buildCartAssistantResponse(normalizedMessage, menuItems) {
  const removeMode = messageHasAny(normalizedMessage, CART_REMOVE_WORDS);
  const matchedProducts = matchProductsFromMessage(normalizedMessage, menuItems).filter((match) => match.product.available);
  const specialNote = removeMode ? '' : extractSpecialNote(normalizedMessage);

  if (matchedProducts.length === 0) {
    return {
      intent: 'none',
      items: [],
      suggested_products: [],
      assistant_message: 'Mesajinizda menude eslesen bir urun bulamadim. Urun adini tekrar yazabilir misiniz?',
      source: 'mock',
    };
  }

  const items = matchedProducts.map((match) => ({
    product_id: match.product.id,
    product_name: match.product.name,
    quantity: match.quantity,
    special_note: specialNote,
    operation: removeMode ? 'remove' : 'add',
  }));

  const joinedNames = items.map((item) => `${item.quantity} x ${item.product_name}`).join(', ');
  const actionText = removeMode ? 'sepetten dusuruldu' : 'sepete eklendi';
  const noteText = specialNote ? ` Not: ${specialNote}.` : '';

  return {
    intent: 'cart_update',
    items,
    suggested_products: [],
    assistant_message: `${joinedNames} ${actionText}.${noteText}`,
    source: 'mock',
  };
}

function buildMenuAssistantResponse(normalizedMessage, menuItems) {
  const suggestions = buildMenuSuggestions(normalizedMessage, menuItems);

  if (suggestions.length === 0) {
    return {
      intent: 'menu_assistant',
      items: [],
      suggested_products: [],
      assistant_message: 'Su an stokta uygun urun gorunmuyor.',
      source: 'mock',
    };
  }

  const labels = suggestions.map((item) => item.name).join(', ');

  return {
    intent: 'menu_assistant',
    items: [],
    suggested_products: suggestions.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      tags: item.tags,
    })),
    assistant_message: `Menuye gore su secenekleri oneririm: ${labels}. Isterseniz karttan sepete ekleyebilirsiniz.`,
    source: 'mock',
  };
}

function normalizeBackendResponse(payload) {
  const intent = payload?.intent || 'none';
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const suggestedProducts = Array.isArray(payload?.suggested_products)
    ? payload.suggested_products
    : Array.isArray(payload?.suggestedProducts)
      ? payload.suggestedProducts
      : [];

  return {
    intent,
    items: items.map((item) => ({
      product_id: Number(item.product_id ?? item.productId),
      product_name: item.product_name ?? item.productName,
      quantity: Number(item.quantity ?? 1),
      special_note: item.special_note ?? item.specialNote ?? '',
      operation: item.operation === 'remove' ? 'remove' : 'add',
    })),
    suggested_products: suggestedProducts.map((row) => ({
      id: Number(row.id ?? row.product_id ?? row.productId),
      name: row.name ?? row.product_name ?? row.productName,
      price: Number(row.price ?? 0),
      tags: Array.isArray(row.tags) ? row.tags : [],
    })),
    assistant_message: payload?.assistant_message ?? payload?.assistantMessage ?? 'Yaniti isleyemedim.',
    source: 'backend',
  };
}

export async function sendAssistantMessage({ message, menuItems, tableId, cartItems = [] }) {
  const trimmedMessage = String(message ?? '').trim();
  if (!trimmedMessage) {
    return {
      intent: 'none',
      items: [],
      suggested_products: [],
      assistant_message: 'Lutfen bir mesaj yazin.',
      source: 'mock',
    };
  }

  const aiEndpoint = getAiEndpoint();
  if (aiEndpoint) {
    try {
      const response = await axios.post(aiEndpoint, {
        tableId: Number(tableId),
        message: trimmedMessage,
        cart: cartItems.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity ?? 1),
          specialNote: line.specialNote ?? '',
        })),
      });
      return normalizeBackendResponse(response.data);
    } catch {
      // If backend AI service is unavailable, fallback parser keeps the flow usable.
    }
  }

  const normalizedMessage = normalizeText(trimmedMessage);
  const hasCartWords = messageHasAny(normalizedMessage, [...CART_ADD_WORDS, ...CART_REMOVE_WORDS]);
  const hasMenuWords = messageHasAny(normalizedMessage, MENU_ASSISTANT_WORDS);
  const matchedProducts = matchProductsFromMessage(normalizedMessage, menuItems);

  if (hasCartWords || matchedProducts.length > 0) {
    return buildCartAssistantResponse(normalizedMessage, menuItems);
  }

  if (hasMenuWords || matchedProducts.length === 0) {
    return buildMenuAssistantResponse(normalizedMessage, menuItems);
  }

  return {
    intent: 'none',
    items: [],
    suggested_products: [],
    assistant_message: 'Mesajinizi menudeki urunlerle eslestiremedim. Urun adi belirtebilir misiniz?',
    source: 'mock',
  };
}
