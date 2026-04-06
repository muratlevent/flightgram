import type { CreateTrackedFlightInput, TrackedFlightRow } from "../types/flight";
import { TrackedFlightRepository } from "../repositories/trackedFlightRepository";
import { UserRepository } from "../repositories/userRepository";

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

  async createTrackedFlight(
    input: CreateTrackedFlightInput,
  ): Promise<TrackedFlightRow> {
    if (input.originCode === input.destinationCode) {
      throw new Error("Origin and destination must be different airport codes.");
    }

    if (input.departureDateEnd < input.departureDateStart) {
      throw new Error("End date cannot be before start date.");
    }

    await this.userRepository.upsertUser(input.userId, input.username);

    return this.trackedFlightRepository.createTrackedFlight({
      user_id: input.userId,
      origin_code: input.originCode,
      destination_code: input.destinationCode,
      departure_date_start: input.departureDateStart,
      departure_date_end: input.departureDateEnd,
      target_price: input.targetPrice,
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
