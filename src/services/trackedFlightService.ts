import type { CreateTrackedFlightInput, TrackedFlightRow } from "../types/flight.js";
import { TrackedFlightRepository } from "../repositories/trackedFlightRepository.js";
import { UserRepository } from "../repositories/userRepository.js";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFlight?: TrackedFlightRow;
}

export class TrackedFlightService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly trackedFlightRepository: TrackedFlightRepository,
    private readonly defaultCurrency: string,
  ) {}

  async registerUser(
    telegramId: string,
    username?: string | null,
  ): Promise<void> {
    await this.userRepository.upsertUser(telegramId, username);
  }

  /**
   * Check if a similar tracker already exists for this user.
   */
  async checkForDuplicate(
    userId: string,
    originCode: string,
    destinationCode: string,
    departureDateStart: string,
    departureDateEnd: string,
  ): Promise<DuplicateCheckResult> {
    const existingFlight = await this.trackedFlightRepository.findDuplicateTracker(
      userId,
      originCode,
      destinationCode,
      departureDateStart,
      departureDateEnd,
    );

    return {
      isDuplicate: existingFlight !== null,
      existingFlight: existingFlight ?? undefined,
    };
  }

  async createTrackedFlight(
    input: CreateTrackedFlightInput,
  ): Promise<TrackedFlightRow> {
    if (input.originCode === input.destinationCode) {
      throw new Error("Origin and destination must be different airport codes.");
    }

    if (input.departureDateEnd < input.departureDateStart) {
      throw new Error("End date cannot be before start date.");
    }

    // Validate return dates if provided
    if (input.returnDateStart && input.returnDateEnd) {
      if (input.returnDateEnd < input.returnDateStart) {
        throw new Error("Return end date cannot be before return start date.");
      }
      // Return date should be after departure date
      if (input.returnDateStart < input.departureDateStart) {
        throw new Error("Return date cannot be before departure date.");
      }
    }

    await this.userRepository.upsertUser(input.userId, input.username);

    return this.trackedFlightRepository.createTrackedFlight({
      user_id: input.userId,
      origin_code: input.originCode,
      destination_code: input.destinationCode,
      departure_date_start: input.departureDateStart,
      departure_date_end: input.departureDateEnd,
      return_date_start: input.returnDateStart ?? null,
      return_date_end: input.returnDateEnd ?? null,
      cabin_class: input.cabinClass,
      max_stops: input.maxStops,
      airlines: input.airlines ? JSON.stringify(input.airlines) : null,
      departure_time_start: input.departureTimeStart ?? null,
      departure_time_end: input.departureTimeEnd ?? null,
      passengers: input.passengers,
      flexible_dates: input.flexibleDates ?? false,
      target_price: input.targetPrice,
      price_drop_percent: input.priceDropPercent ?? null,
      currency: input.currency || this.defaultCurrency,
      is_active: true,
    });
  }

  async listActiveTrackedFlights(userId: string): Promise<TrackedFlightRow[]> {
    return this.trackedFlightRepository.listActiveFlightsForUser(userId);
  }

  async deleteTrackedFlight(
    userId: string,
    trackedFlightId: string,
  ): Promise<TrackedFlightRow | null> {
    return this.trackedFlightRepository.deactivateTrackedFlight(
      trackedFlightId,
      userId,
    );
  }
}
