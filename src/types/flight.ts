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
}
