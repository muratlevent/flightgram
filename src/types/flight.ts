import type { CabinClass, MaxStops } from './flightOptions';

export interface UserRow {
  telegram_id: string;
  username: string | null;
  created_at: string;
}

export interface TrackedFlightRow {
  id: string;
  user_id: string;
  origin_code: string;
  destination_code: string;
  departure_date_start: string;
  departure_date_end: string;
  // Round-trip return dates (null for one-way)
  return_date_start: string | null;
  return_date_end: string | null;
  // Flight search options
  cabin_class: CabinClass;
  max_stops: MaxStops;
  airlines: string | null;  // JSON array string or null
  departure_time_start: string | null;
  departure_time_end: string | null;
  passengers: number;
  // Price tracking
  target_price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface TrackedFlightInsert {
  id?: string;
  user_id: string;
  origin_code: string;
  destination_code: string;
  departure_date_start: string;
  departure_date_end: string;
  // Round-trip return dates (optional for one-way)
  return_date_start?: string | null;
  return_date_end?: string | null;
  // Flight search options
  cabin_class?: CabinClass;
  max_stops?: MaxStops;
  airlines?: string | null;
  departure_time_start?: string | null;
  departure_time_end?: string | null;
  passengers?: number;
  // Price tracking
  target_price: number;
  currency: string;
  is_active?: boolean;
  created_at?: string;
}

export interface PriceHistoryInsert {
  id?: number;
  flight_id: string;
  provider_name: string;
  price: number;
  checked_at?: string;
}

export interface PriceAlertRow {
  id: number;
  flight_id: string;
  provider_name: string;
  price: number;
  currency: string;
  deep_link: string | null;
  sent_at: string;
}

export interface PriceAlertInsert {
  flight_id: string;
  provider_name: string;
  price: number;
  currency: string;
  deep_link?: string | null;
  sent_at?: string;
}

export interface CreateTrackedFlightInput {
  userId: string;
  username?: string | null;
  originCode: string;
  destinationCode: string;
  departureDateStart: string;
  departureDateEnd: string;
  // Round-trip return dates (optional for one-way)
  returnDateStart?: string | null;
  returnDateEnd?: string | null;
  // Flight search options
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
  airlines?: string[];  // Array of airline codes
  departureTimeStart?: string | null;
  departureTimeEnd?: string | null;
  passengers?: number;
  // Price tracking
  targetPrice: number;
  currency: string;
}

export interface ProviderFlightQuote {
  providerName: string;
  price: number;
  currency: string;
  checkedAt: string;
  deepLink?: string;
  /** The specific date this quote is for (within a date range) */
  departureDate?: string;
  /** Return date for round-trip flights */
  returnDate?: string;
}
