import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_RULES = [
  { category: 'İçecek', keys: ['kola', 'ayran', 'su', 'çay', 'cay', 'kahve', 'icecek', 'içecek', 'limonata', 'soda', 'mojito'] },
  { category: 'Tatlı', keys: ['tatli', 'tatlı', 'sutlac', 'sütlaç', 'tiramisu', 'pasta', 'brownie', 'cheesecake', 'waffle'] },
  { category: 'Çorba', keys: ['corba', 'çorba', 'mercimek', 'ezogelin', 'domates'] },
  { category: 'Kahvaltılık', keys: ['omlet', 'menemen', 'simit', 'tost', 'kahvalti', 'kahvaltı', 'pankek'] },
  { category: 'Salata', keys: ['salata', 'sezar', 'gavurdagi', 'gavurdağı', 'yesillik', 'yeşillik'] },
  { category: 'Atıştırmalık', keys: ['patates', 'atistirmalik', 'atıştırmalık', 'nugget', 'sogan halkasi', 'soğan halkası', 'mozzarella'] },
  { category: 'Burger', keys: ['hamburger', 'burger', 'cheeseburger'] },
  { category: 'Pizza', keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'dört peynir'] },
  { category: 'Kebap', keys: ['lahmacun', 'doner', 'döner', 'kebap', 'adana', 'sis', 'şiş', 'kofte', 'köfte'] },
  { category: 'Makarna', keys: ['makarna', 'penne', 'spagetti', 'alfredo'] },
];

const TAG_RULES = [
  { tag: 'sütlü tatlı', keys: ['sutlac', 'sütlaç', 'tiramisu', 'cheesecake'] },
  { tag: 'acısız', keys: ['sutlac', 'sütlaç', 'ayran', 'kola', 'su', 'salata', 'kahve', 'çay', 'cay', 'limonata'] },
  { tag: 'popüler', keys: ['hamburger', 'pizza', 'patates', 'kola', 'lahmacun', 'menemen'] },
  { tag: 'tavuk', keys: ['tavuk', 'chicken'] },
  { tag: 'vegan', keys: ['vegan', 'yesillik', 'yeşillik', 'falafel'] },
  { tag: 'sıcak servis', keys: ['corba', 'çorba', 'kahve', 'çay', 'cay', 'pizza', 'lahmacun'] },
];

const IMAGE_RULES = [
  {
    keys: ['hamburger', 'burger', 'cheeseburger'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'dört peynir'],
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['lahmacun', 'pide'],
    imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kebap', 'adana', 'doner', 'döner', 'sis', 'şiş', 'kofte', 'köfte'],
    imageUrl: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['salata', 'sezar', 'yesillik', 'yeşillik'],
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['patates', 'fries', 'nugget', 'atistirmalik', 'atıştırmalık'],
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['tiramisu', 'tatli', 'tatlı', 'pasta', 'cheesecake', 'brownie', 'sutlac', 'sütlaç'],
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kahve', 'espresso', 'latte', 'cappuccino'],
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['çay', 'cay', 'tea'],
    imageUrl: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['kola', 'ayran', 'su', 'icecek', 'içecek', 'limonata', 'soda', 'mojito'],
    imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['corba', 'çorba', 'mercimek', 'ezogelin', 'domates'],
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['omlet', 'menemen', 'kahvalti', 'kahvaltı', 'simit', 'tost', 'pankek'],
    imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=960&q=80',
  },
  {
    keys: ['makarna', 'spagetti', 'penne', 'alfredo'],
    imageUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=960&q=80',
  },
];

const CATEGORY_FALLBACK_IMAGES = {
  İçecek: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=960&q=80',
  Tatlı: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=960&q=80',
  Çorba: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=960&q=80',
  Kahvaltılık: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=960&q=80',
  Salata: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=960&q=80',
  Atıştırmalık: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=960&q=80',
  Burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=80',
  Pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=960&q=80',
  Kebap: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?auto=format&fit=crop&w=960&q=80',
  Makarna: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=960&q=80',
};

const DEFAULT_IMAGE_URL =
  'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=960&q=80';

const CATEGORY_LABEL_MAP = {
  icecek: 'İçecek',
  tatli: 'Tatlı',
  corba: 'Çorba',
  kahvaltilik: 'Kahvaltılık',
  atistirmalik: 'Atıştırmalık',
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
  if (category === 'İçecek') {
    return `${name} siparişinize serin bir eşlikçi olur.`;
  }

  if (category === 'Tatlı') {
    return `${name} yemek sonrası tatlı tercihi için uygundur.`;
  }

  if (category === 'Çorba') {
    return `${name} günün sıcak başlangıcı için hazırlanır.`;
  }

  if (category === 'Kahvaltılık') {
    return `${name} kahvaltı ve brunch için popüler seçenekler arasındadır.`;
  }

  return `${name} mutfağın mevcut menüsü içinde servis edilir.`;
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
  const name = rawProduct?.name ?? 'Ürün';
  const price = Number(rawProduct?.price ?? 0);
  const stock = Number(rawProduct?.stock ?? 0);
  const normalizedCategory = normalizeCategoryLabel(rawProduct?.category?.trim());
  const category = normalizedCategory || inferCategory(name);
  const tags = Array.isArray(rawProduct?.tags) ? rawProduct.tags : inferTags(name, stock);
  const description = rawProduct?.description?.trim() || inferDescription(name, category);

  // Use deterministic product-name based images to avoid unrelated random pictures.
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
    const categoryKey = product.category || 'Diğer';
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
