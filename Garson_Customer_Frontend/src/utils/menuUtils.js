import { includesPhrase, normalizeText } from './textUtils';

const CATEGORY_RULES = [
  { category: 'İçecekler', keys: ['kola', 'ayran', 'su', 'cay', 'kahve', 'icecek', 'limonata', 'soda', 'salgam', 'frappe', 'portakal suyu'] },
  { category: 'Tatlılar', keys: ['tatli', 'sutlac', 'tiramisu', 'pasta', 'brownie', 'cheesecake', 'waffle', 'kunefe', 'baklava', 'profiterol'] },
  { category: 'Çorbalar', keys: ['corba', 'mercimek', 'ezogelin', 'domates', 'tavuk suyu'] },
  { category: 'Kahvaltılıklar', keys: ['omlet', 'menemen', 'simit', 'tost', 'kahvalti', 'pankek', 'sucuklu yumurta', 'serpme'] },
  { category: 'Salatalar', keys: ['salata', 'sezar', 'gavurdagi', 'yesillik', 'akdeniz', 'ton balikli'] },
  { category: 'Atıştırmalıklar', keys: ['patates', 'atistirmalik', 'nugget', 'sogan halkasi', 'mozzarella', 'sigara boregi'] },
  { category: 'Hamburgerler', keys: ['hamburger', 'burger', 'cheeseburger', 'bbq burger', 'mantarli burger'] },
  { category: 'Pizzalar', keys: ['pizza', 'margherita', 'pepperoni', 'dort peynir', 'vejetaryen pizza'] },
  { category: 'Kebablar', keys: ['lahmacun', 'doner', 'kebap', 'adana', 'sis', 'kofte', 'urfa', 'iskender'] },
  { category: 'Makarnalar', keys: ['makarna', 'penne', 'spagetti', 'alfredo', 'arabiata', 'napoliten', 'fettuccine', 'kremali'] },
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
  icecek: 'İçecekler',
  icecekler: 'İçecekler',
  tatli: 'Tatlılar',
  tatlilar: 'Tatlılar',
  corba: 'Çorbalar',
  corbalar: 'Çorbalar',
  kahvaltilik: 'Kahvaltılıklar',
  kahvaltiliklar: 'Kahvaltılıklar',
  salata: 'Salatalar',
  salatalar: 'Salatalar',
  atistirmalik: 'Atıştırmalıklar',
  atistirmaliklar: 'Atıştırmalıklar',
  burger: 'Hamburgerler',
  hamburger: 'Hamburgerler',
  hamburgerler: 'Hamburgerler',
  pizza: 'Pizzalar',
  pizzalar: 'Pizzalar',
  kebap: 'Kebablar',
  kebab: 'Kebablar',
  kebablar: 'Kebablar',
  makarna: 'Makarnalar',
  makarnalar: 'Makarnalar',
  'ana yemek': 'Ana Yemekler',
  'ana yemekler': 'Ana Yemekler',
};

const CATEGORY_ORDER = [
  'Kahvaltılıklar',
  'Atıştırmalıklar',
  'Hamburgerler',
  'Pizzalar',
  'Kebablar',
  'Makarnalar',
  'Salatalar',
  'Tatlılar',
  'İçecekler',
  'Ana Yemekler',
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
  if (!/[ÃÅÄ]/.test(text)) {
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
  return normalizeText(repairText(input));
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

  if (normalizedName.endsWith(' cheesecake')) {
    candidates.add(normalizedName.replace(/ cheesecake$/, ''));
  }

  if (normalizedName.includes(' doner')) {
    candidates.add(normalizedName.replaceAll(' doner', ' döner'));
  }

  return Array.from(candidates).filter(Boolean);
}

function findImageEntry(name, category) {
  const normalizedCategory = normalizeAssetText(category);
  const categoryEntries = LOCAL_IMAGE_ENTRIES.filter((entry) => entry.normalizedCategory === normalizedCategory);

  if (!categoryEntries.length) {
    return null;
  }

  const nameCandidates = buildNameCandidates(name);

  for (const candidate of nameCandidates) {
    const exactMatch = categoryEntries.find((entry) => entry.normalizedName === candidate);
    if (exactMatch) {
      return exactMatch;
    }
  }

  for (const candidate of nameCandidates) {
    const partialMatch = categoryEntries.find(
      (entry) => entry.normalizedName.includes(candidate) || candidate.includes(entry.normalizedName),
    );
    if (partialMatch) {
      return partialMatch;
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

  return 'Ana Yemekler';
}

function inferTags(name, stock) {
  const normalizedName = normalizeAssetText(name);
  const tags = TAG_RULES.filter((rule) => rule.keys.some((key) => includesPhrase(normalizedName, key))).map(
    (rule) => rule.tag,
  );

  if (Number(stock ?? 0) <= 0) {
    tags.push('stok yok');
  }

  return Array.from(new Set(tags));
}

function inferDescription(name, category) {
  if (category === 'İçecekler') {
    return `${name} siparişinize serin bir eşlikçi olur.`;
  }

  if (category === 'Tatlılar') {
    return `${name} yemek sonrası tatlı tercihi için uygundur.`;
  }

  if (category === 'Kahvaltılıklar') {
    return `${name} kahvaltı ve brunch için popüler seçenekler arasındadır.`;
  }

  if (category === 'Makarnalar') {
    return `${name} taze soslarla sıcak servis edilen makarna seçeneğidir.`;
  }

  return `${name} mutfağın mevcut menüsü içinde servis edilir.`;
}

function scoreProduct(product) {
  const name = String(product.name ?? '');
  let score = 0;

  if (!/[ÃÅÄ]/.test(name)) {
    score += 10;
  }

  score += (name.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length * 2;
  score += Number(product.available) * 2;
  score += Math.min(Number(product.stock ?? 0), 999) / 1000;

  return score;
}

export function enrichProduct(rawProduct) {
  const id = Number(rawProduct?.id);
  const name = repairText(rawProduct?.name ?? 'Ürün');
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
    const categoryKey = product.category || 'Diğer';
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
