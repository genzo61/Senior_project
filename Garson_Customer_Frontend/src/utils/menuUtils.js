import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_RULES = [
  { category: 'Icecek', keys: ['kola', 'ayran', 'su', 'cay', 'kahve', 'icecek', 'limonata', 'soda', 'salgam', 'frappe', 'portakal suyu'] },
  { category: 'Tatli', keys: ['tatli', 'sutlac', 'tiramisu', 'pasta', 'brownie', 'cheesecake', 'waffle', 'kunefe', 'baklava', 'profiterol'] },
  { category: 'Corba', keys: ['corba', 'mercimek', 'ezogelin', 'domates', 'tavuk suyu'] },
  { category: 'Kahvaltilik', keys: ['omlet', 'menemen', 'simit', 'tost', 'kahvalti', 'pankek', 'sucuklu yumurta', 'serpme'] },
  { category: 'Salata', keys: ['salata', 'sezar', 'gavurdagi', 'yesillik', 'akdeniz', 'ton balikli'] },
  { category: 'Atistirmalik', keys: ['patates', 'atistirmalik', 'nugget', 'sogan halkasi', 'mozzarella', 'sigara boregi'] },
  { category: 'Burger', keys: ['hamburger', 'burger', 'cheeseburger', 'bbq burger', 'mantarli burger'] },
  { category: 'Pizza', keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'vejetaryen pizza'] },
  { category: 'Kebap', keys: ['lahmacun', 'doner', 'kebap', 'adana', 'sis', 'kofte', 'urfa', 'iskender'] },
  { category: 'Makarna', keys: ['makarna', 'penne', 'spagetti', 'alfredo', 'arabiata', 'napoliten', 'fettuccine', 'kremali'] },
];

const TAG_RULES = [
  { tag: 'sutlu tatli', keys: ['sutlac', 'tiramisu', 'cheesecake', 'profiterol', 'san sebastian'] },
  { tag: 'acisiz', keys: ['sutlac', 'ayran', 'kola', 'su', 'salata', 'kahve', 'cay', 'limonata', 'soda', 'portakal suyu'] },  
  { tag: 'populer', keys: ['hamburger', 'pizza', 'patates', 'kola', 'lahmacun', 'menemen', 'double cheeseburger', 'iskender', 'kunefe'] },
  { tag: 'tavuk', keys: ['tavuk', 'chicken'] },
  { tag: 'vegan', keys: ['vegan', 'yesillik', 'falafel', 'vejetaryen pizza', 'gavurdagi'] },
  { tag: 'sicak servis', keys: ['corba', 'kahve', 'cay', 'pizza', 'lahmacun', 'kebap', 'makarna', 'kunefe'] },
];

const IMAGE_RULES = [
  {
    keys: ['hamburger', 'burger', 'cheeseburger', 'double cheeseburger', 'bbq burger', 'mantarli burger'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'vejetaryen pizza'],
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['lahmacun', 'pide'],
    imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kebap', 'adana', 'doner', 'sis', 'kofte', 'urfa', 'iskender'],
    imageUrl: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['salata', 'sezar', 'yesillik', 'akdeniz', 'gavurdagi', 'ton balikli'],
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['patates', 'fries', 'nugget', 'atistirmalik', 'mozzarella', 'sigara boregi', 'sogan halkasi'],
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['tiramisu', 'tatli', 'pasta', 'cheesecake', 'brownie', 'sutlac', 'kunefe', 'baklava', 'profiterol', 'san sebastian'],
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kahve', 'espresso', 'latte', 'cappuccino', 'turk kahvesi', 'frappe'],
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['cay', 'tea'],
    imageUrl: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kola', 'ayran', 'su', 'icecek', 'limonata', 'soda', 'salgam', 'portakal suyu'],
    imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['corba', 'mercimek', 'ezogelin', 'domates', 'tavuk suyu'],
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['omlet', 'menemen', 'kahvalti', 'simit', 'tost', 'pankek', 'sucuklu yumurta', 'serpme'],
    imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['makarna', 'spagetti', 'penne', 'alfredo', 'arabiata', 'napoliten', 'fettuccine', 'kremali'],
    imageUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=960&q=80',
  },
];

const CATEGORY_FALLBACK_IMAGES = {
  Icecek: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=960&q=80',
  Tatli: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=960&q=80',
  Corba: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=960&q=80',
  Kahvaltilik: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=960&q=80',
  Salata: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=960&q=80',
  Atistirmalik: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=960&q=80',
  Burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=80',
  Pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=960&q=80',
  Kebap: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=960&q=80',
  Makarna: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=960&q=80',
};

const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=960&q=80';

const CATEGORY_LABEL_MAP = {
  icecek: 'Icecek',
  tatli: 'Tatli',
  corba: 'Corba',
  kahvaltilik: 'Kahvaltilik',
  atistirmalik: 'Atistirmalik',
  salata: 'Salata',
  burger: 'Burger',
  pizza: 'Pizza',
  kebap: 'Kebap',
  makarna: 'Makarna',
  'ana yemek': 'Ana Yemek',
};

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

  if (category === 'Makarna') {
    return `${name} taze soslarla sicak servis edilen makarna secenegidir.`;
  }

  return `${name} mutfagin mevcut menusu icinde servis edilir.`;
}

function inferImageUrl(name, category) {
  const normalizedName = normalizeText(name);
  const rule = IMAGE_RULES.find((row) => row.keys.some((key) => includesPhrase(normalizedName, key)));
  if (rule?.imageUrl) {
    return rule.imageUrl;
  }

  return CATEGORY_FALLBACK_IMAGES[category] ?? DEFAULT_IMAGE_URL;
}

function normalizeCategoryLabel(category) {
  const normalizedCategory = normalizeText(category);
  if (!normalizedCategory) {
    return '';
  }
  return CATEGORY_LABEL_MAP[normalizedCategory] ?? category;
}

export function enrichProduct(rawProduct) {
  const id = Number(rawProduct?.id);
  const name = rawProduct?.name ?? 'Urun';
  const price = Number(rawProduct?.price ?? 0);
  const stock = Number(rawProduct?.stock ?? 0);
  const normalizedCategory = normalizeCategoryLabel(rawProduct?.category?.trim());
  const category = normalizedCategory || inferCategory(name);
  const tags = Array.isArray(rawProduct?.tags) ? rawProduct.tags : inferTags(name, stock);
  const description = rawProduct?.description?.trim() || inferDescription(name, category);

  // Keep menu cards on a deterministic image instead of a random remote pick.
  const imageUrl = inferImageUrl(name, category);

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
