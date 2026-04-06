import {
  CABIN_CLASSES,
  type CabinClass,
  MAX_STOPS_OPTIONS,
  type MaxStops,
} from '../types/flightOptions.js';

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

/**
 * Parse cabin class input.
 * Accepts: "1", "2", "3", "4" or full names like "economy", "business"
 */
export function parseCabinClass(value: string): CabinClass | null {
  const normalized = value.trim().toUpperCase();

  // Check if it's a number selection (1-4)
  const numMap: Record<string, CabinClass> = {
    '1': 'ECONOMY',
    '2': 'PREMIUM_ECONOMY',
    '3': 'BUSINESS',
    '4': 'FIRST',
  };

  if (numMap[normalized]) {
    return numMap[normalized];
  }

  // Check direct match
  if (CABIN_CLASSES.includes(normalized as CabinClass)) {
    return normalized as CabinClass;
  }

  // Check partial match (e.g., "economy" -> "ECONOMY")
  const partialMap: Record<string, CabinClass> = {
    ECONOMY: 'ECONOMY',
    PREMIUM: 'PREMIUM_ECONOMY',
    'PREMIUM ECONOMY': 'PREMIUM_ECONOMY',
    BUSINESS: 'BUSINESS',
    FIRST: 'FIRST',
    'FIRST CLASS': 'FIRST',
  };

  if (partialMap[normalized]) {
    return partialMap[normalized];
  }

  return null;
}

/**
 * Parse max stops input.
 * Accepts: "1", "2", "3", "4" or keywords like "any", "direct", "non-stop"
 */
export function parseMaxStops(value: string): MaxStops | null {
  const normalized = value.trim().toUpperCase().replace(/-/g, '_');

  // Check if it's a number selection (1-4)
  const numMap: Record<string, MaxStops> = {
    '1': 'ANY',
    '2': 'NON_STOP',
    '3': 'ONE_STOP',
    '4': 'TWO_PLUS_STOPS',
  };

  if (numMap[normalized]) {
    return numMap[normalized];
  }

  // Check direct match
  if (MAX_STOPS_OPTIONS.includes(normalized as MaxStops)) {
    return normalized as MaxStops;
  }

  // Check keyword matches
  const keywordMap: Record<string, MaxStops> = {
    ANY: 'ANY',
    ALL: 'ANY',
    DIRECT: 'NON_STOP',
    NONSTOP: 'NON_STOP',
    NON_STOP: 'NON_STOP',
    '0': 'NON_STOP',
    ONE: 'ONE_STOP',
    ONE_STOP: 'ONE_STOP',
    '1_STOP': 'ONE_STOP',
    TWO: 'TWO_PLUS_STOPS',
    TWO_PLUS: 'TWO_PLUS_STOPS',
    TWO_PLUS_STOPS: 'TWO_PLUS_STOPS',
    '2+': 'TWO_PLUS_STOPS',
  };

  if (keywordMap[normalized]) {
    return keywordMap[normalized];
  }

  return null;
}

/**
 * Parse airlines input.
 * Accepts comma or space separated airline codes (2-letter IATA codes).
 * Example: "TK, LH, BA" or "TK LH BA"
 */
export function parseAirlines(value: string): string[] | null {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  // Split by comma or whitespace
  const codes = normalized.split(/[,\s]+/).filter((code) => code.length > 0);

  if (codes.length === 0) {
    return null;
  }

  // Validate each code (2-3 letter IATA codes)
  for (const code of codes) {
    if (!/^[A-Z0-9]{2,3}$/.test(code)) {
      return null;
    }
  }

  return codes;
}

/**
 * Parse time window input.
 * Accepts formats like "06-20", "6-20", "06:00-20:00"
 * Returns normalized format "HH-HH" (e.g., "06-20")
 */
export function parseTimeWindow(value: string): string | null {
  const normalized = value.trim();

  // Match patterns like "6-20", "06-20", "06:00-20:00"
  const match = normalized.match(
    /^(\d{1,2})(?::00)?\s*[-–]\s*(\d{1,2})(?::00)?$/,
  );

  if (!match) {
    return null;
  }

  const startHour = Number.parseInt(match[1], 10);
  const endHour = Number.parseInt(match[2], 10);

  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
    return null;
  }

  if (startHour >= endHour) {
    return null;
  }

  // Format as HH-HH
  const startStr = startHour.toString().padStart(2, '0');
  const endStr = endHour.toString().padStart(2, '0');

  return `${startStr}-${endStr}`;
}

/**
 * Parse passenger count.
 * Accepts a number between 1 and 9.
 */
export function parsePassengers(value: string): number | null {
  const normalized = value.trim();
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 9) {
    return null;
  }

  return parsed;
}

/**
 * Check if a value indicates "skip" for optional fields.
 */
export function isSkip(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['skip', 'atla', '-', 'hayır', 'no', 'n', 's'].includes(normalized);
}

/**
 * Parse price drop percentage (1-100).
 */
export function parsePriceDropPercent(value: string): number | null {
  const normalized = value.trim().replace('%', '');
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    return null;
  }

  return parsed;
}
