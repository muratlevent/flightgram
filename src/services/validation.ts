export function normalizeAirportCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeDepartureDate(value: string): string | null {
  const normalized = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsedDate = new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  if (parsedDate < todayUtc) {
    return null;
  }

  return normalized;
}

/**
 * Parse a date range input.
 * Accepts formats:
 * - Single date: "2026-05-01" (returns same date for start and end)
 * - Date range: "2026-05-01 to 2026-05-15" or "2026-05-01 - 2026-05-15"
 *
 * Returns null if invalid, or { start, end } if valid.
 */
export function parseDateRange(
  value: string,
): { start: string; end: string } | null {
  const normalized = value.trim();

  // Try to parse as a range (formats: "date1 to date2", "date1 - date2", "date1-date2" with spaces)
  const rangeMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})$/i,
  );

  if (rangeMatch) {
    const startDate = normalizeDepartureDate(rangeMatch[1]);
    const endDate = normalizeDepartureDate(rangeMatch[2]);

    if (!startDate || !endDate) {
      return null;
    }

    // End date must be >= start date
    if (endDate < startDate) {
      return null;
    }

    return { start: startDate, end: endDate };
  }

  // Try to parse as single date
  const singleDate = normalizeDepartureDate(normalized);
  if (singleDate) {
    return { start: singleDate, end: singleDate };
  }

  return null;
}

export function parsePositivePrice(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

export function normalizeCurrencyCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
