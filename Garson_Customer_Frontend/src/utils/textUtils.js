const TR_CHAR_MAP = {
  c: /[ç]/g,
  g: /[ð]/g,
  i: /[ýiÝ]/g,
  o: /[ö]/g,
  s: /[þ]/g,
  u: /[ü]/g,
};

function toAscii(input) {
  let output = String(input ?? '').toLowerCase();
  Object.entries(TR_CHAR_MAP).forEach(([target, pattern]) => {
    output = output.replace(pattern, target);
  });
  return output;
}

export function normalizeText(input) {
  return toAscii(input)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input) {
  const normalized = normalizeText(input);
  return normalized ? normalized.split(' ') : [];
}

export function includesPhrase(normalizedText, phrase) {
  if (!normalizedText || !phrase) {
    return false;
  }

  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) {
    return false;
  }

  if (normalizedPhrase.includes(' ')) {
    return normalizedText.includes(normalizedPhrase);
  }

  return tokenize(normalizedText).includes(normalizedPhrase);
}

export function toSentenceCase(text) {
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatPrice(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}
