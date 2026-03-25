import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_RULES = [
  { category: 'Icecek', keys: ['kola', 'ayran', 'su', 'cay', 'kahve', 'icecek', 'limonata', 'soda', 'mojito'] },
  { category: 'Tatli', keys: ['tatli', 'sutlac', 'tiramisu', 'pasta', 'brownie', 'cheesecake', 'waffle'] },
  { category: 'Corba', keys: ['corba', 'mercimek', 'ezogelin', 'domates'] },
  { category: 'Kahvaltilik', keys: ['omlet', 'menemen', 'simit', 'tost', 'kahvalti', 'pankek'] },
  { category: 'Salata', keys: ['salata', 'sezar', 'gavurdagi', 'yesillik'] },
  { category: 'Atistirmalik', keys: ['patates', 'atistirmalik', 'nugget', 'sogan halkasi', 'mozzarella'] },
  { category: 'Burger', keys: ['hamburger', 'burger', 'cheeseburger'] },
  { category: 'Pizza', keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir'] },
  { category: 'Kebap', keys: ['lahmacun', 'doner', 'kebap', 'adana', 'sis', 'kofte'] },
  { category: 'Makarna', keys: ['makarna', 'penne', 'spagetti', 'alfredo'] },
];

const TAG_RULES = [
  { tag: 'sutlu tatli', keys: ['sutlac', 'tiramisu', 'cheesecake'] },
  { tag: 'acisiz', keys: ['sutlac', 'ayran', 'kola', 'su', 'salata', 'kahve', 'cay', 'limonata'] },
  { tag: 'popular', keys: ['hamburger', 'pizza', 'patates', 'kola', 'lahmacun', 'menemen'] },
  { tag: 'tavuk', keys: ['tavuk', 'chicken'] },
  { tag: 'vegan', keys: ['vegan', 'yesillik', 'falafel'] },
  { tag: 'sicak servis', keys: ['corba', 'kahve', 'cay', 'pizza', 'lahmacun'] },
];

const IMAGE_RULES = [
  { keys: ['hamburger', 'burger'], imageUrl: 'https://loremflickr.com/640/460/burger?lock=11' },
  { keys: ['pizza'], imageUrl: 'https://loremflickr.com/640/460/pizza?lock=12' },
  { keys: ['lahmacun'], imageUrl: 'https://loremflickr.com/640/460/lahmacun?lock=13' },
  { keys: ['kebap', 'adana', 'doner', 'sis'], imageUrl: 'https://loremflickr.com/640/460/kebab?lock=14' },
  { keys: ['salata', 'sezar'], imageUrl: 'https://loremflickr.com/640/460/salad?lock=15' },
  { keys: ['patates', 'fries'], imageUrl: 'https://loremflickr.com/640/460/fries?lock=16' },
  { keys: ['tiramisu', 'tatli', 'pasta', 'cheesecake', 'brownie'], imageUrl: 'https://loremflickr.com/640/460/dessert?lock=17' },
  { keys: ['kahve'], imageUrl: 'https://loremflickr.com/640/460/coffee?lock=18' },
  { keys: ['cay'], imageUrl: 'https://loremflickr.com/640/460/tea?lock=19' },
  { keys: ['kola', 'ayran', 'su', 'icecek', 'limonata'], imageUrl: 'https://loremflickr.com/640/460/drink?lock=20' },
  { keys: ['corba', 'mercimek', 'ezogelin'], imageUrl: 'https://loremflickr.com/640/460/soup?lock=21' },
  { keys: ['omlet', 'menemen', 'kahvalti', 'simit', 'tost'], imageUrl: 'https://loremflickr.com/640/460/breakfast?lock=22' },
  { keys: ['makarna', 'spagetti', 'penne'], imageUrl: 'https://loremflickr.com/640/460/pasta?lock=23' },
];

const DEFAULT_IMAGE_URL = 'https://loremflickr.com/640/460/restaurant-food?lock=24';

function inferCategory(name) {
  const normalizedName = normalizeText(name);

  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((key) => includesPhrase(normalizedName, key))) {
      return rule.category;
    }
  }

  return 'Ana Yemek';
}

function inferTags(name, stock) {
  const normalizedName = normalizeText(name);
  const tags = TAG_RULES.filter((rule) => rule.keys.some((key) => includesPhrase(normalizedName, key))).map(
    (rule) => rule.tag,
  );

  if (Number(stock ?? 0) <= 0) {
    tags.push('stok yok');
  }

  return Array.from(new Set(tags));
}

function inferDescription(name, category) {
  if (category === 'Icecek') {
    return `${name} siparisinize serin bir eslikci olur.`;
  }

  if (category === 'Tatli') {
    return `${name} yemek sonrasi tatli tercihi icin uygundur.`;
  }

  if (category === 'Corba') {
    return `${name} gunun sicak baslangici icin hazirlanir.`;
  }

  if (category === 'Kahvaltilik') {
    return `${name} kahvalti ve brunch icin populer secenekler arasindadir.`;
  }

  return `${name} mutfagin mevcut menusu icinde servis edilir.`;
}

function inferImageUrl(name) {
  const normalizedName = normalizeText(name);
  const rule = IMAGE_RULES.find((row) => row.keys.some((key) => includesPhrase(normalizedName, key)));
  return rule?.imageUrl ?? DEFAULT_IMAGE_URL;
}

export function enrichProduct(rawProduct) {
  const id = Number(rawProduct?.id);
  const name = rawProduct?.name ?? 'Urun';
  const price = Number(rawProduct?.price ?? 0);
  const stock = Number(rawProduct?.stock ?? 0);
  const category = rawProduct?.category?.trim() || inferCategory(name);
  const tags = Array.isArray(rawProduct?.tags) ? rawProduct.tags : inferTags(name, stock);
  const description = rawProduct?.description?.trim() || inferDescription(name, category);
  const imageUrl = rawProduct?.imageUrl?.trim() || inferImageUrl(name);

  return {
    id,
    name,
    price: Number.isFinite(price) ? price : 0,
    stock,
    category,
    description,
    tags,
    imageUrl,
    available: stock > 0,
  };
}

export function groupProductsByCategory(products) {
  return products.reduce((groups, product) => {
    const categoryKey = product.category || 'Diger';
    if (!groups[categoryKey]) {
      groups[categoryKey] = [];
    }
    groups[categoryKey].push(product);
    return groups;
  }, {});
}

export function sortProducts(products) {
  return [...products].sort((a, b) => {
    if (a.category === b.category) {
      return a.name.localeCompare(b.name, 'tr');
    }
    return a.category.localeCompare(b.category, 'tr');
  });
}
