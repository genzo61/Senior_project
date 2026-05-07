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
  'çorba',
  'içecek',
  'salata',
  'burger',
  'pizza',
  'kebap',
  'makarna',
];
const MENU_LISTING_WORDS = ['ne var', 'neler var', 'hangi', 'listesi', 'listele', 'menu'];
const SMALL_TALK_WORDS = ['merhaba', 'selam', 'nasilsin', 'orada misin', 'yardim', 'konusalim'];
const THANK_WORDS = ['tesekkur', 'sagol', 'eyvallah'];

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

function detectCategoryFromMessage(normalizedMessage) {
  if (messageHasAny(normalizedMessage, ['icecek', 'kola', 'ayran', 'kahve', 'cay', 'limonata', 'soda', 'salgam'])) {
    return 'Icecek';
  }
  if (messageHasAny(normalizedMessage, ['tatli', 'sutlu', 'brownie', 'cheesecake', 'kunefe', 'baklava', 'profiterol'])) {
    return 'Tatli';
  }
  if (messageHasAny(normalizedMessage, ['salata', 'vegan'])) {
    return 'Salata';
  }
  if (messageHasAny(normalizedMessage, ['corba', 'mercimek', 'ezogelin', 'domates', 'tavuk suyu'])) {
    return 'Corba';
  }
  if (messageHasAny(normalizedMessage, ['kahvalti', 'menemen', 'tost', 'simit', 'pankek', 'serpme'])) {
    return 'Kahvaltilik';
  }
  if (messageHasAny(normalizedMessage, ['atistirmalik', 'patates', 'halkasi', 'nugget', 'mozzarella'])) {
    return 'Atistirmalik';
  }
  if (messageHasAny(normalizedMessage, ['burger', 'hamburger'])) {
    return 'Burger';
  }
  if (messageHasAny(normalizedMessage, ['pizza'])) {
    return 'Pizza';
  }
  if (messageHasAny(normalizedMessage, ['kebap', 'lahmacun', 'doner', 'kofte', 'sis', 'urfa', 'iskender'])) {
    return 'Kebap';
  }
  if (messageHasAny(normalizedMessage, ['makarna', 'penne', 'alfredo', 'fettuccine', 'arabiata', 'napoliten'])) {
    return 'Makarna';
  }
  return '';
}

function buildMenuSuggestions(normalizedMessage, menuItems) {
  const inStock = menuItems.filter((item) => item.available);
  const detectedCategory = detectCategoryFromMessage(normalizedMessage);

  if (detectedCategory) {
    return inStock.filter((item) => item.category === detectedCategory).slice(0, 10);
  }

  if (includesPhrase(normalizedMessage, 'sutlu') || includesPhrase(normalizedMessage, 'tatli')) {
    return inStock.filter((item) => item.tags.includes('sutlu tatli')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'hafif')) {
    return inStock.filter((item) => ['Salata', 'Icecek', 'Tatli', 'Corba'].includes(item.category)).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'tavuk')) {
    return inStock.filter((item) => includesPhrase(normalizeText(item.name), 'tavuk')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'acisiz')) {
    return inStock.filter((item) => item.tags.includes('acisiz')).slice(0, 6);
  }

  if (includesPhrase(normalizedMessage, 'vegan')) {
    return inStock.filter((item) => item.tags.includes('vegan')).slice(0, 6);
  }

  return inStock.slice(0, 6);
}

function buildMenuAssistantMessage(normalizedMessage, suggestions) {
  const labels = suggestions.map((item) => item.name).join(', ');
  const detectedCategory = detectCategoryFromMessage(normalizedMessage);
  if (detectedCategory) {
    return `${detectedCategory} kategorisinde su urunler var: ${labels}. Isterseniz istediginizi sepete ekleyebilirim.`;
  }
  return `Su anki tercihinize gore bunlari oneririm: ${labels}.`;
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
      assistant_message: 'Mesajinizda menuyle eslesen bir urun bulamadim. Ornek: "2 kola ekle" veya "bir lahmacun cikar".',
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
      assistant_message: 'Rica ederim. Isterseniz yeni bir urun onerisi de yapabilirim.',
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
      ? `Buradayim. Sohbet edebiliriz veya hizlica su urunlerden baslayabiliriz: ${suggestionText}.`
      : 'Buradayim. Isterseniz menuden bir urun adi yazin, birlikte secelim.',
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
      ? `Isterseniz soyle yazabilirsiniz: "2 ${sample.split(', ')[0] ?? 'kola'} ekle" veya "hafif bir sey oner".`
      : 'Mesaji anlayamadim. Urun adi veya "oner" gibi bir ifade kullanabilirsiniz.',
    source: 'mock',
  };
}

export async function sendAssistantMessage({ message, menuItems, tableNo, cartItems = [] }) {
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
      const response = await axios.post(
        aiEndpoint,
        {
          tableNo: Number(tableNo),
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
      // Backend AI is optional; local fallback keeps the assistant usable.
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
