const TABLE_CONTEXT_STORAGE_KEY = 'garson_mobile_table_context';

function toTableNo(candidate) {
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

  const directTableNo = toTableNo(decodedToken);
  if (directTableNo) {
    return directTableNo;
  }

  const prefixedMatch = decodedToken.match(/(?:table|masa)[\s:=-]*(\d+)/i);
  if (prefixedMatch?.[1]) {
    return toTableNo(prefixedMatch[1]);
  }

  const queryMatch = decodedToken.match(/[?&](?:tableNo|table)=(\d+)/i);
  if (queryMatch?.[1]) {
    return toTableNo(queryMatch[1]);
  }

  const fromBase64 = decodeBase64Token(decodedToken);
  if (fromBase64) {
    const base64Direct = toTableNo(fromBase64);
    if (base64Direct) {
      return base64Direct;
    }

    try {
      const parsed = JSON.parse(fromBase64);
      return toTableNo(parsed?.tableNo ?? parsed?.table ?? parsed?.table_id ?? null);
    } catch {
      return null;
    }
  }

  return null;
}

export function parseTableFromSearchParams(searchParams) {
  const rawTableNo = searchParams.get('tableNo');
  if (rawTableNo !== null) {
    return toTableNo(rawTableNo);
  }

  return toTableNo(searchParams.get('table'));
}

export function resolveTableNoFromSearchParams(searchParams) {
  const rawTableNo = searchParams.get('tableNo');
  if (rawTableNo !== null) {
    const parsedTableNo = toTableNo(rawTableNo);
    return {
      tableNo: parsedTableNo,
      source: 'tableNo',
      hasQueryParam: true,
      shouldNormalize: parsedTableNo !== null && searchParams.has('table'),
    };
  }

  const rawLegacyTable = searchParams.get('table');
  if (rawLegacyTable !== null) {
    const parsedLegacy = toTableNo(rawLegacyTable);
    return {
      tableNo: parsedLegacy,
      source: 'table',
      hasQueryParam: true,
      shouldNormalize: parsedLegacy !== null,
    };
  }

  return {
    tableNo: null,
    source: null,
    hasQueryParam: false,
    shouldNormalize: false,
  };
}

export function buildNormalizedTableSearchParams(searchParams, tableNoCandidate) {
  const tableNo = toTableNo(tableNoCandidate);
  if (!tableNo) {
    return null;
  }

  const normalized = new URLSearchParams(searchParams);
  normalized.delete('table');
  normalized.set('tableNo', String(tableNo));
  return normalized;
}

export function saveTableContext(context) {
  const tableNo = toTableNo(context?.tableNo ?? context?.tableId);
  if (!tableNo) {
    return;
  }

  const payload = {
    tableNo,
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
    const tableNo = toTableNo(parsed?.tableNo ?? parsed?.tableId);
    if (!tableNo) {
      return null;
    }
    return {
      ...parsed,
      tableNo,
    };
  } catch {
    return null;
  }
}

export function clearTableContext() {
  sessionStorage.removeItem(TABLE_CONTEXT_STORAGE_KEY);
}
