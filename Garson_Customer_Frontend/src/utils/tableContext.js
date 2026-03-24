const TABLE_CONTEXT_STORAGE_KEY = 'garson_mobile_table_context';

function toTableId(candidate) {
  const parsed = Number(String(candidate ?? '').trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function decodeBase64Token(token) {
  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
}

export function parseTableToken(token) {
  if (!token) {
    return null;
  }

  const decodedToken = decodeURIComponent(String(token).trim());

  const directTableId = toTableId(decodedToken);
  if (directTableId) {
    return directTableId;
  }

  const prefixedMatch = decodedToken.match(/(?:table|masa)[\s:=-]*(\d+)/i);
  if (prefixedMatch?.[1]) {
    return toTableId(prefixedMatch[1]);
  }

  const queryMatch = decodedToken.match(/[?&]table=(\d+)/i);
  if (queryMatch?.[1]) {
    return toTableId(queryMatch[1]);
  }

  const fromBase64 = decodeBase64Token(decodedToken);
  if (fromBase64) {
    const base64Direct = toTableId(fromBase64);
    if (base64Direct) {
      return base64Direct;
    }

    try {
      const parsed = JSON.parse(fromBase64);
      return toTableId(parsed?.table ?? parsed?.tableNo ?? parsed?.table_id ?? null);
    } catch {
      return null;
    }
  }

  return null;
}

export function parseTableFromSearchParams(searchParams) {
  const value = searchParams.get('table');
  return toTableId(value);
}

export function saveTableContext(context) {
  if (!context?.tableId) {
    return;
  }

  const payload = {
    tableId: Number(context.tableId),
    source: context.source ?? 'unknown',
    storedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(TABLE_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
}

export function getStoredTableContext() {
  const raw = sessionStorage.getItem(TABLE_CONTEXT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.tableId) {
      return null;
    }
    return {
      ...parsed,
      tableId: Number(parsed.tableId),
    };
  } catch {
    return null;
  }
}

export function clearTableContext() {
  sessionStorage.removeItem(TABLE_CONTEXT_STORAGE_KEY);
}
