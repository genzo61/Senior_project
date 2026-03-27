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

const CART_ADD_WORDS = ['ekle', 'olsun', 'isterim', 'istiyorum', 'alalim', 'almak', 'sepete at', 'koy'];
const CART_REMOVE_WORDS = ['cikar', 'sil', 'istemiyorum', 'olmasin', 'iptal'];
const MENU_ASSISTANT_WORDS = [
  'oner',
  'onerir',
  'onerirsin',
  'onerir misin',
  'tavsiye',
  'ne var',
  'neler var',
  'hangi',
  'listesi',
  'listele',
  'hafif',
  'yanina',
  'acisiz',
  'tatli',
  'tavuk',
  'vegan',
  'kahvalti',
  'corba',
  'icecek',
];
const MENU_LISTING_WORDS = ['ne var', 'neler var', 'hangi', 'listesi', 'listele', 'menu', 'menü'];
const SMALL_TALK_WORDS = ['merhaba', 'selam', 'nasilsin', 'orada misin', 'yardim', 'konusalim'];
const THANK_WORDS = ['tesekkur', 'sagol', 'eyvallah'];

const NOTE_PATTERNS = [
  { token: 'acili', note: 'Acılı olsun' },
  { token: 'sogansiz', note: 'Soğansız' },
  { token: 'sekersiz', note: 'Şekersiz' },
  { token: 'az tuzlu', note: 'Az tuzlu' },
  { token: 'tuzsuz', note: 'Tuzsuz' },
  { token: 'az pis', note: 'Az pişirilsin' },
  { token: 'iyi pismis', note: 'İyi pişmiş olsun' },
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
  const detectedCategory = detectCategoryFromMessage(normalizedMessage);

  if (detectedCategory) {
    return inStock.filter((item) => item.category === detectedCategory).slice(0, 10);
  }

  if (includesPhrase(normalizedMessage, 'sutlu') || includesPhrase(normalizedMessage, 'tatli')) {
    return inStock.filter((item) => item.tags.includes('sütlü tatlı')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'hafif')) {
    return inStock.filter((item) => ['Salata', 'İçecek', 'Tatlı', 'Çorba'].includes(item.category)).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'tavuk')) {
    return inStock.filter((item) => includesPhrase(normalizeText(item.name), 'tavuk')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'acisiz')) {
    return inStock.filter((item) => item.tags.includes('acısız')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'vegan')) {
    return inStock.filter((item) => item.tags.includes('vegan')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'kahvalti')) {
    return inStock.filter((item) => item.category === 'Kahvaltılık').slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'corba')) {
    return inStock.filter((item) => item.category === 'Çorba').slice(0, 6);
  }

  return inStock.slice(0, 6);
}

function detectCategoryFromMessage(normalizedMessage) {
  if (messageHasAny(normalizedMessage, ['icecek', 'kola', 'ayran', 'kahve', 'cay', 'limonata'])) {
    return 'İçecek';
  }
  if (messageHasAny(normalizedMessage, ['tatli', 'sutlu', 'brownie', 'cheesecake'])) {
    return 'Tatlı';
  }
  if (messageHasAny(normalizedMessage, ['salata', 'vegan'])) {
    return 'Salata';
  }
  if (messageHasAny(normalizedMessage, ['corba', 'mercimek', 'ezogelin'])) {
    return 'Çorba';
  }
  if (messageHasAny(normalizedMessage, ['kahvalti', 'menemen', 'tost', 'simit'])) {
    return 'Kahvaltılık';
  }
  if (messageHasAny(normalizedMessage, ['atistirmalik', 'patates', 'halkasi'])) {
    return 'Atıştırmalık';
  }
  if (messageHasAny(normalizedMessage, ['burger', 'hamburger'])) {
    return 'Burger';
  }
  if (messageHasAny(normalizedMessage, ['pizza'])) {
    return 'Pizza';
  }
  if (messageHasAny(normalizedMessage, ['kebap', 'lahmacun', 'doner', 'kofte', 'sis'])) {
    return 'Kebap';
  }
  return '';
}

function buildMenuAssistantMessage(normalizedMessage, suggestions) {
  const labels = suggestions.map((item) => item.name).join(', ');
  const detectedCategory = detectCategoryFromMessage(normalizedMessage);
  if (detectedCategory) {
    return `${detectedCategory} kategorisinde şu ürünler var: ${labels}. İsterseniz istediğinizi sepete ekleyebilirim.`;
  }
  return `Şu anki tercihinize göre bunları öneririm: ${labels}.`;
}

function buildCartAssistantResponse(normalizedMessage, menuItems) {
  const removeMode = messageHasAny(normalizedMessage, CART_REMOVE_WORDS);
  const matchedProducts = matchProductsFromMessage(normalizedMessage, menuItems).filter((match) => match.product.available);
  const specialNote = removeMode ? '' : extractSpecialNote(normalizedMessage);

  if (matchedProducts.length === 0) {
    return {
      intent: 'clarification',
      items: [],
      suggested_products: [],
      assistant_message:
        'Mesajınızda menüde eşleşen bir ürün bulamadım. Örnek: "2 kola ekle" veya "bir lahmacun çıkar".',
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
  const actionText = removeMode ? 'sepetten düşürüldü' : 'sepete eklendi';
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
      assistant_message: 'Şu an stokta uygun ürün görünmüyor.',
      source: 'mock',
    };
  }

  return {
    intent: 'menu_assistant',
    items: [],
    suggested_products: suggestions.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      tags: item.tags,
    })),
    assistant_message: buildMenuAssistantMessage(normalizedMessage, suggestions),
    source: 'mock',
  };
}

function buildSmallTalkResponse(normalizedMessage, menuItems) {
  const inStock = menuItems.filter((item) => item.available).slice(0, 3);
  const suggestionText = inStock.map((item) => item.name).join(', ');

  if (messageHasAny(normalizedMessage, THANK_WORDS)) {
    return {
      intent: 'clarification',
      items: [],
      suggested_products: [],
      assistant_message: 'Rica ederim. İsterseniz yeni bir ürün önerisi de yapabilirim.',
      source: 'mock',
    };
  }

  return {
    intent: 'menu_assistant',
    items: [],
    suggested_products: inStock.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      tags: item.tags,
    })),
    assistant_message: suggestionText
      ? `Buradayım. Sohbet edebiliriz veya hızlıca şu ürünlerden başlayabiliriz: ${suggestionText}.`
      : 'Buradayım. İsterseniz menüden bir ürün adı yazın, birlikte seçelim.',
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
    assistant_message: payload?.assistant_message ?? payload?.assistantMessage ?? 'Yanıtı işleyemedim.',
    source: 'backend',
  };
}

function buildClarificationResponse(menuItems) {
  const sample = menuItems
    .filter((item) => item.available)
    .slice(0, 2)
    .map((item) => item.name)
    .join(', ');

  return {
    intent: 'clarification',
    items: [],
    suggested_products: [],
    assistant_message: sample
      ? `İsterseniz şöyle yazabilirsiniz: "2 ${sample.split(', ')[0] ?? 'kola'} ekle" veya "hafif bir şey öner".`
      : 'Mesajı anlayamadım. Ürün adı veya "öner" gibi bir ifade kullanabilirsiniz.',
    source: 'mock',
  };
}

export async function sendAssistantMessage({ message, menuItems, tableId, cartItems = [] }) {
  const trimmedMessage = String(message ?? '').trim();
  if (!trimmedMessage) {
    return {
      intent: 'none',
      items: [],
      suggested_products: [],
      assistant_message: 'Lütfen bir mesaj yazın.',
      source: 'mock',
    };
  }

  const aiEndpoint = getAiEndpoint();
  if (aiEndpoint) {
    try {
      const response = await axios.post(
        aiEndpoint,
        {
          tableId: Number(tableId),
          message: trimmedMessage,
          cart: cartItems.map((line) => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity ?? 1),
            specialNote: line.specialNote ?? '',
          })),
        },
        {
          timeout: 7000,
        },
      );
      return normalizeBackendResponse(response.data);
    } catch {
      // Backend is optional; local parser keeps assistant usable.
    }
  }

  const normalizedMessage = normalizeText(trimmedMessage);
  const hasCartWords = messageHasAny(normalizedMessage, [...CART_ADD_WORDS, ...CART_REMOVE_WORDS]);
  const hasMenuWords = messageHasAny(normalizedMessage, MENU_ASSISTANT_WORDS);
  const hasMenuListingWords = messageHasAny(normalizedMessage, MENU_LISTING_WORDS);
  const hasSmallTalk = messageHasAny(normalizedMessage, SMALL_TALK_WORDS) || messageHasAny(normalizedMessage, THANK_WORDS);
  const matchedProducts = matchProductsFromMessage(normalizedMessage, menuItems);

  if (hasCartWords || matchedProducts.length > 0) {
    return buildCartAssistantResponse(normalizedMessage, menuItems);
  }

  if (hasMenuWords || hasMenuListingWords) {
    return buildMenuAssistantResponse(normalizedMessage, menuItems);
  }

  if (hasSmallTalk) {
    return buildSmallTalkResponse(normalizedMessage, menuItems);
  }

  return buildClarificationResponse(menuItems);
}
