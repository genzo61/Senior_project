import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_LABELS = {
  drinks: '\u0130\u00e7ecekler',
  desserts: 'Tatl\u0131lar',
  soups: '\u00c7orbalar',
  breakfast: 'Kahvalt\u0131l\u0131klar',
  salads: 'Salatalar',
  snacks: 'At\u0131\u015ft\u0131rmal\u0131klar',
  burgers: 'Hamburgerler',
  pizzas: 'Pizzalar',
  kebabs: 'Kebablar',
  pastas: 'Makarnalar',
  mains: 'Ana Yemekler',
  other: 'Di\u011fer',
};

const CATEGORY_RULES = [
  { category: CATEGORY_LABELS.drinks, keys: ['kola', 'ayran', 'su', 'cay', 'kahve', 'icecek', 'limonata', 'soda', 'salgam', 'frappe', 'portakal suyu'] },
  { category: CATEGORY_LABELS.desserts, keys: ['tatli', 'sutlac', 'tiramisu', 'pasta', 'brownie', 'cheesecake', 'waffle', 'kunefe', 'baklava', 'profiterol'] },
  { category: CATEGORY_LABELS.soups, keys: ['corba', 'mercimek', 'ezogelin', 'domates', 'tavuk suyu'] },
  { category: CATEGORY_LABELS.breakfast, keys: ['omlet', 'menemen', 'simit', 'tost', 'kahvalti', 'pankek', 'sucuklu yumurta', 'serpme'] },
  { category: CATEGORY_LABELS.salads, keys: ['salata', 'sezar', 'gavurdagi', 'yesillik', 'akdeniz', 'ton balikli', 'coban'] },
  { category: CATEGORY_LABELS.snacks, keys: ['patates', 'atistirmalik', 'nugget', 'sogan halkasi', 'mozzarella', 'sigara boregi'] },
  { category: CATEGORY_LABELS.burgers, keys: ['hamburger', 'burger', 'cheeseburger', 'bbq burger', 'mantarli burger'] },
  { category: CATEGORY_LABELS.pizzas, keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'vejetaryen pizza'] },
  { category: CATEGORY_LABELS.kebabs, keys: ['lahmacun', 'doner', 'kebap', 'adana', 'sis', 'kofte', 'urfa', 'iskender'] },
  { category: CATEGORY_LABELS.pastas, keys: ['makarna', 'penne', 'spagetti', 'alfredo', 'arabiata', 'napoliten', 'fettuccine', 'kremali'] },
];

const TAG_RULES = [
  { tag: 'sutlu tatli', keys: ['sutlac', 'tiramisu', 'cheesecake', 'profiterol', 'san sebastian'] },
  { tag: 'acisiz', keys: ['sutlac', 'ayran', 'kola', 'su', 'salata', 'kahve', 'cay', 'limonata', 'soda', 'portakal suyu'] },
  { tag: 'populer', keys: ['hamburger', 'pizza', 'patates', 'kola', 'lahmacun', 'menemen', 'double cheeseburger', 'iskender', 'kunefe'] },
  { tag: 'tavuk', keys: ['tavuk', 'chicken'] },
  { tag: 'vegan', keys: ['vegan', 'yesillik', 'falafel', 'vejetaryen pizza', 'gavurdagi'] },
  { tag: 'sicak servis', keys: ['corba', 'kahve', 'cay', 'pizza', 'lahmacun', 'kebap', 'makarna', 'kunefe'] },
];

const LOCAL_IMAGE_MODULES = import.meta.glob('../../../images/**/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  import: 'default',
});

const CATEGORY_LABEL_MAP = {
  icecek: CATEGORY_LABELS.drinks,
  icecekler: CATEGORY_LABELS.drinks,
  'i cecek': CATEGORY_LABELS.drinks,
  'i cecekler': CATEGORY_LABELS.drinks,
  tatli: CATEGORY_LABELS.desserts,
  tatlilar: CATEGORY_LABELS.desserts,
  corba: CATEGORY_LABELS.soups,
  corbalar: CATEGORY_LABELS.soups,
  kahvaltilik: CATEGORY_LABELS.breakfast,
  kahvaltiliklar: CATEGORY_LABELS.breakfast,
  salata: CATEGORY_LABELS.salads,
  salatalar: CATEGORY_LABELS.salads,
  atistirmalik: CATEGORY_LABELS.snacks,
  atistirmaliklar: CATEGORY_LABELS.snacks,
  burger: CATEGORY_LABELS.burgers,
  hamburger: CATEGORY_LABELS.burgers,
  hamburgerler: CATEGORY_LABELS.burgers,
  pizza: CATEGORY_LABELS.pizzas,
  pizzalar: CATEGORY_LABELS.pizzas,
  kebap: CATEGORY_LABELS.kebabs,
  kebab: CATEGORY_LABELS.kebabs,
  kebablar: CATEGORY_LABELS.kebabs,
  makarna: CATEGORY_LABELS.pastas,
  makarnalar: CATEGORY_LABELS.pastas,
  'ana yemek': CATEGORY_LABELS.mains,
  'ana yemekler': CATEGORY_LABELS.mains,
};

const CATEGORY_ORDER = [
  CATEGORY_LABELS.breakfast,
  CATEGORY_LABELS.drinks,
  CATEGORY_LABELS.snacks,
  CATEGORY_LABELS.burgers,
  CATEGORY_LABELS.pizzas,
  CATEGORY_LABELS.kebabs,
  CATEGORY_LABELS.pastas,
  CATEGORY_LABELS.salads,
  CATEGORY_LABELS.desserts,
  CATEGORY_LABELS.mains,
];

const LOCAL_IMAGE_ENTRIES = Object.entries(LOCAL_IMAGE_MODULES)
  .map(([filePath, src]) => {
    const segments = filePath.split('/');
    const folderName = segments.at(-2) ?? '';
    const fileName = segments.at(-1) ?? '';
    const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    const normalizedFolder = normalizeAssetText(folderName);

    return {
      filePath,
      src,
      category: CATEGORY_LABEL_MAP[normalizedFolder] ?? repairText(folderName),
      normalizedCategory: normalizedFolder,
      normalizedName: normalizeAssetText(baseName),
    };
  })
  .sort((left, right) => left.filePath.localeCompare(right.filePath, 'tr'));

function repairText(input) {
  const text = String(input ?? '');
  if (!/[\u00c3\u00c4\u00c5]/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return decoded.includes('\uFFFD') ? text : decoded;
  } catch {
    return text;
  }
}

function normalizeAssetText(input) {
  return normalizeText(repairText(input).replace(/\u0307/g, ''));
}

function buildNameCandidates(name) {
  const normalizedName = normalizeAssetText(name);
  const candidates = new Set([normalizedName]);

  if (normalizedName.includes('margherita')) {
    candidates.add(normalizedName.replaceAll('margherita', 'margarita'));
  }

  if (normalizedName.includes('vejetaryen')) {
    candidates.add(normalizedName.replaceAll('vejetaryen', 'vejeteryan'));
  }

  if (normalizedName.endsWith(' salata')) {
    candidates.add(normalizedName.replace(/ salata$/, ' salatasi'));
  }

  if (normalizedName === 'soda') {
    candidates.add('sade soda');
  }

  if (normalizedName === 'kahve') {
    candidates.add('turk kahvesi');
  }

  if (normalizedName.endsWith(' cheesecake')) {
    candidates.add(normalizedName.replace(/ cheesecake$/, ''));
  }

  if (normalizedName.includes(' doner')) {
    candidates.add(normalizedName.replaceAll(' doner', ' doneri'));
  }

  return Array.from(candidates).filter(Boolean);
}

function findImageEntry(name, category) {
  const normalizedCategory = normalizeAssetText(category);
  const categoryEntries = LOCAL_IMAGE_ENTRIES.filter((entry) => entry.normalizedCategory === normalizedCategory);
  const searchableEntries = categoryEntries.length ? categoryEntries : LOCAL_IMAGE_ENTRIES;

  const nameCandidates = buildNameCandidates(name);

  for (const candidate of nameCandidates) {
    const exactMatch = searchableEntries.find((entry) => entry.normalizedName === candidate);
    if (exactMatch) {
      return exactMatch;
    }
  }

  for (const candidate of nameCandidates) {
    const partialMatch = searchableEntries.find(
      (entry) => entry.normalizedName.includes(candidate) || candidate.includes(entry.normalizedName),
    );
    if (partialMatch) {
      return partialMatch;
    }
  }

  if (searchableEntries !== LOCAL_IMAGE_ENTRIES) {
    for (const candidate of nameCandidates) {
      const globalExactMatch = LOCAL_IMAGE_ENTRIES.find((entry) => entry.normalizedName === candidate);
      if (globalExactMatch) {
        return globalExactMatch;
      }
    }

    for (const candidate of nameCandidates) {
      const globalPartialMatch = LOCAL_IMAGE_ENTRIES.find(
        (entry) => entry.normalizedName.includes(candidate) || candidate.includes(entry.normalizedName),
      );
      if (globalPartialMatch) {
        return globalPartialMatch;
      }
    }
  }

  return null;
}

function normalizeCategoryLabel(category) {
  const normalizedCategory = normalizeAssetText(category);
  if (!normalizedCategory) {
    return '';
  }

  return CATEGORY_LABEL_MAP[normalizedCategory] ?? repairText(category);
}

function inferCategory(name) {
  const normalizedName = normalizeAssetText(name);

  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((key) => includesPhrase(normalizedName, key))) {
      return rule.category;
    }
  }

  return CATEGORY_LABELS.mains;
}

function inferTags(name, stock) {
  const normalizedName = normalizeAssetText(name);
  const tags = TAG_RULES
    .filter((rule) => rule.keys.some((key) => includesPhrase(normalizedName, key)))
    .map((rule) => rule.tag);

  if (Number(stock ?? 0) <= 0) {
    tags.push('stok yok');
  }

  return Array.from(new Set(tags));
}

function inferDescription(name, category) {
  if (category === CATEGORY_LABELS.drinks) {
    return `${name} siparisinize serin bir eslikci olur.`;
  }

  if (category === CATEGORY_LABELS.desserts) {
    return `${name} yemek sonrasi tatli tercihi icin uygundur.`;
  }

  if (category === CATEGORY_LABELS.breakfast) {
    return `${name} kahvalti ve brunch icin populer secenekler arasindadir.`;
  }

  if (category === CATEGORY_LABELS.pastas) {
    return `${name} taze soslarla sicak servis edilen makarna secenegidir.`;
  }

  return `${name} mutfagin mevcut menusu icinde servis edilir.`;
}

function scoreProduct(product) {
  const name = String(product.name ?? '');
  let score = 0;

  if (!/[\u00c3\u00c4\u00c5]/.test(name)) {
    score += 10;
  }

  score += Number(product.available) * 2;
  score += Math.min(Number(product.stock ?? 0), 999) / 1000;

  return score;
}

export function enrichProduct(rawProduct) {
  const id = Number(rawProduct?.id);
  const name = repairText(rawProduct?.name ?? 'Urun');
  const price = Number(rawProduct?.price ?? 0);
  const stock = Number(rawProduct?.stock ?? 0);
  const normalizedCategory = normalizeCategoryLabel(rawProduct?.category?.trim());
  const inferredCategory = normalizedCategory || inferCategory(name);
  const matchedImage = findImageEntry(name, inferredCategory);

  if (!matchedImage) {
    return null;
  }

  const description = repairText(rawProduct?.description?.trim()) || inferDescription(name, matchedImage.category);
  const rawTags = Array.isArray(rawProduct?.tags) ? rawProduct.tags.map((tag) => repairText(tag)) : null;

  return {
    id,
    name,
    price: Number.isFinite(price) ? price : 0,
    stock,
    category: matchedImage.category,
    description,
    tags: rawTags?.length ? rawTags : inferTags(name, stock),
    imageUrl: matchedImage.src,
    imageKey: matchedImage.filePath,
    available: stock > 0,
  };
}

export function prepareMenuProducts(rawProducts) {
  const menuByImage = new Map();

  rawProducts
    .map(enrichProduct)
    .filter(Boolean)
    .forEach((product) => {
      const existing = menuByImage.get(product.imageKey);
      if (!existing || scoreProduct(product) > scoreProduct(existing)) {
        menuByImage.set(product.imageKey, product);
      }
    });

  return sortProducts(
    Array.from(menuByImage.values()).map(({ imageKey, ...product }) => product),
  );
}

export function groupProductsByCategory(products) {
  return products.reduce((groups, product) => {
    const categoryKey = product.category || CATEGORY_LABELS.other;
    if (!groups[categoryKey]) {
      groups[categoryKey] = [];
    }
    groups[categoryKey].push(product);
    return groups;
  }, {});
}

export function sortProducts(products) {
  return [...products].sort((left, right) => {
    const leftCategoryIndex = CATEGORY_ORDER.indexOf(left.category);
    const rightCategoryIndex = CATEGORY_ORDER.indexOf(right.category);

    if (leftCategoryIndex !== rightCategoryIndex) {
      return (leftCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : leftCategoryIndex)
        - (rightCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : rightCategoryIndex);
    }

    return left.name.localeCompare(right.name, 'tr');
  });
}
