import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_RULES = [
  { category: 'Icecek', keys: ['kola', 'ayran', 'su', 'cay', 'kahve', 'icecek'] },
  { category: 'Tatli', keys: ['tatli', 'sutlac', 'tiramisu', 'pasta'] },
  { category: 'Salata', keys: ['salata'] },
  { category: 'Atistirmalik', keys: ['patates', 'atistirmalik'] },
  { category: 'Ana Yemek', keys: ['hamburger', 'burger', 'pizza', 'lahmacun', 'doner', 'corba'] },
];

const TAG_RULES = [
  { tag: 'sutlu tatli', keys: ['sutlac', 'tiramisu'] },
  { tag: 'acisiz', keys: ['sutlac', 'ayran', 'kola', 'su', 'salata', 'kahve', 'cay'] },
  { tag: 'popular', keys: ['hamburger', 'pizza', 'patates', 'kola'] },
  { tag: 'tavuk', keys: ['tavuk'] },
];

function inferCategory(name) {
  const normalizedName = normalizeText(name);

  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((key) => includesPhrase(normalizedName, key))) {
      return rule.category;
    }
  }

  return 'Diger';
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

  return `${name} mutfagin mevcut menusu icinde servis edilir.`;
}

export function enrichProduct(rawProduct) {
  const id = Number(rawProduct?.id);
  const name = rawProduct?.name ?? 'Urun';
  const price = Number(rawProduct?.price ?? 0);
  const stock = Number(rawProduct?.stock ?? 0);
  const category = rawProduct?.category?.trim() || inferCategory(name);
  const tags = Array.isArray(rawProduct?.tags) ? rawProduct.tags : inferTags(name, stock);
  const description = rawProduct?.description?.trim() || inferDescription(name, category);

  return {
    id,
    name,
    price: Number.isFinite(price) ? price : 0,
    stock,
    category,
    description,
    tags,
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
