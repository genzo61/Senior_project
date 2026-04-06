import { clampNumber, normalizeText } from './textUtils';

function generateLineId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNote(note) {
  return normalizeText(note ?? '');
}

function findLineIndex(cartItems, productId, specialNote) {
  const normalizedNote = normalizeNote(specialNote);
  return cartItems.findIndex(
    (line) => line.productId === productId && normalizeNote(line.specialNote) === normalizedNote,
  );
}

export function addProductToCart(cartItems, product, options = {}) {
  const quantity = clampNumber(Number(options.quantity ?? 1), 1, 99);
  const specialNote = (options.specialNote ?? '').trim();
  const source = options.source ?? 'manual';

  const nextItems = [...cartItems];
  const existingIndex = findLineIndex(nextItems, product.id, specialNote);

  if (existingIndex >= 0) {
    const existing = nextItems[existingIndex];
    nextItems[existingIndex] = {
      ...existing,
      quantity: clampNumber(existing.quantity + quantity, 1, 99),
      source,
    };
    return nextItems;
  }

  nextItems.push({
    lineId: generateLineId(),
    productId: product.id,
    productName: product.name,
    price: Number(product.price ?? 0),
    quantity,
    specialNote,
    source,
  });

  return nextItems;
}

function decreaseOrRemove(cartItems, productId, quantity = 1) {
  let remaining = clampNumber(Number(quantity ?? 1), 1, 99);

  return cartItems
    .map((line) => {
      if (line.productId !== productId || remaining <= 0) {
        return line;
      }

      const deduction = Math.min(line.quantity, remaining);
      remaining -= deduction;

      return {
        ...line,
        quantity: line.quantity - deduction,
      };
    })
    .filter((line) => line.quantity > 0);
}

export function applyStructuredCartItems(cartItems, items, menuMap) {
  let nextCart = [...cartItems];

  for (const item of items) {
    const productId = Number(item.product_id ?? item.productId);
    const product = menuMap.get(productId);

    if (!product) {
      continue;
    }

    const quantity = clampNumber(Number(item.quantity ?? 1), 1, 99);
    const operation = item.operation === 'remove' ? 'remove' : 'add';

    if (operation === 'remove') {
      nextCart = decreaseOrRemove(nextCart, product.id, quantity);
      continue;
    }

    nextCart = addProductToCart(nextCart, product, {
      quantity,
      specialNote: item.special_note ?? item.specialNote ?? '',
      source: 'ai',
    });
  }

  return nextCart;
}

export function setCartLineQuantity(cartItems, lineId, quantity) {
  const normalizedQuantity = clampNumber(Number(quantity ?? 1), 0, 99);
  if (normalizedQuantity === 0) {
    return cartItems.filter((line) => line.lineId !== lineId);
  }

  return cartItems.map((line) =>
    line.lineId === lineId
      ? {
          ...line,
          quantity: normalizedQuantity,
        }
      : line,
  );
}

export function removeCartLine(cartItems, lineId) {
  return cartItems.filter((line) => line.lineId !== lineId);
}

export function setCartLineNote(cartItems, lineId, specialNote) {
  return cartItems.map((line) =>
    line.lineId === lineId
      ? {
          ...line,
          specialNote,
        }
      : line,
  );
}

export function getCartTotal(cartItems) {
  return cartItems.reduce((total, line) => total + Number(line.price ?? 0) * Number(line.quantity ?? 0), 0);
}

export function buildOrderPayload(tableNo, cartItems) {
  const groupedItems = new Map();

  cartItems.forEach((line) => {
    const note = (line.specialNote ?? '').trim();
    const key = `${line.productId}|${line.productName}|${note}`;

    if (!groupedItems.has(key)) {
      groupedItems.set(key, {
        productId: Number(line.productId),
        productName: line.productName,
        quantity: 0,
        price: line.price,
        specialNote: note,
      });
    }

    const bucket = groupedItems.get(key);
    bucket.quantity += Number(line.quantity ?? 0);
  });

  return {
    tableNo: String(tableNo),
    items: Array.from(groupedItems.values()).filter((line) => line.quantity > 0),
  };
}
