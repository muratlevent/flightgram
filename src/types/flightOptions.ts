/**
 * Flight search option types
 */

export const CABIN_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
export type CabinClass = typeof CABIN_CLASSES[number];

export const MAX_STOPS_OPTIONS = ['ANY', 'NON_STOP', 'ONE_STOP', 'TWO_PLUS_STOPS'] as const;
export type MaxStops = typeof MAX_STOPS_OPTIONS[number];

export const CABIN_CLASS_LABELS: Record<CabinClass, string> = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First Class',
};

export const MAX_STOPS_LABELS: Record<MaxStops, string> = {
  ANY: 'Any',
  NON_STOP: 'Non-stop only',
  ONE_STOP: 'Max 1 stop',
  TWO_PLUS_STOPS: 'Max 2+ stops',
};

export const CABIN_CLASS_EMOJIS: Record<CabinClass, string> = {
  ECONOMY: '💺',
  PREMIUM_ECONOMY: '💺✨',
  BUSINESS: '🛋️',
  FIRST: '👑',
};

export const MAX_STOPS_EMOJIS: Record<MaxStops, string> = {
  ANY: '🔄',
  NON_STOP: '✈️',
  ONE_STOP: '1️⃣',
  TWO_PLUS_STOPS: '2️⃣',
};

/**
 * Flight search options passed to provider
 */
export interface FlightSearchOptions {
  returnDate?: string;
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
  airlines?: string[];
  departureTimeWindow?: string;  // "06-20" format
  passengers?: number;
}

/**
 * Options for cheapest dates search
 */
export interface CheapestDatesOptions {
  /** Round-trip search */
  isRoundTrip?: boolean;
  /** Trip duration in days (for round-trip) */
  tripDuration?: number;
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
  airlines?: string[];
  departureTimeWindow?: string;  // "06-20" format
  passengers?: number;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Check if a value is a valid CabinClass
 */
export function isCabinClass(value: string): value is CabinClass {
  return CABIN_CLASSES.includes(value as CabinClass);
}

/**
 * Check if a value is a valid MaxStops
 */
export function isMaxStops(value: string): value is MaxStops {
  return MAX_STOPS_OPTIONS.includes(value as MaxStops);
}
