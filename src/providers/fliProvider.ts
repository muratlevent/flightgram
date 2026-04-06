import { spawn } from "node:child_process";
import type { CheapestDatesResult, ProviderFlightQuote } from "../types/flight.js";
import type { FlightSearchOptions, CheapestDatesOptions, CabinClass, MaxStops } from "../types/flightOptions.js";
import type { FlightProvider } from "./flightProvider.js";

interface FliFlightLeg {
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  duration: number;
  airline: string;
  airline_code: string;
  flight_number: string;
}

interface FliFlight {
  price: number;
  currency: string;
  legs: FliFlightLeg[];
}

interface FliSearchResponse {
  success: boolean;
  flights: FliFlight[];
  count: number;
  trip_type: string;
  error?: string;
}

/**
 * Response from `fli dates` command
 */
interface FliDateOption {
  departure_date: string;
  return_date?: string;
  price: number;
  currency: string;
}

interface FliDatesResponse {
  success: boolean;
  dates: FliDateOption[];
  count: number;
  error?: string;
}

interface FliProviderOptions {
  currency: string;
  fliPath?: string;
  timeoutMs?: number;
  /** Maximum number of days to query in a date range (default: 14) */
  maxDateRangeDays?: number;
}

/**
 * FliProvider uses the punitarani/fli CLI tool to search flights.
 *
 * fli must be installed: `pipx install flights`
 *
 * @see https://github.com/punitarani/fli
 */
export class FliProvider implements FlightProvider {
  readonly name = "fli";

  private readonly currency: string;
  private readonly fliPath: string;
  private readonly timeoutMs: number;
  private readonly maxDateRangeDays: number;

  constructor(options: FliProviderOptions) {
    this.currency = options.currency;
    this.fliPath = options.fliPath ?? "fli";
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.maxDateRangeDays = options.maxDateRangeDays ?? 14;
  }

  async getCheapestFlight(
    origin: string,
    destination: string,
    date: string,
    currency?: string,
    options?: FlightSearchOptions,
  ): Promise<ProviderFlightQuote | null> {
    const args = [
      "flights",
      origin.toUpperCase(),
      destination.toUpperCase(),
      date,
      "--format",
      "json",
      "--sort",
      "CHEAPEST",
    ];

    // Add return date for round-trip
    if (options?.returnDate) {
      args.push("--return", options.returnDate);
    }

    // Add cabin class (fli uses: economy, premium-economy, business, first)
    if (options?.cabinClass) {
      const cabinMap: Record<CabinClass, string> = {
        ECONOMY: "economy",
        PREMIUM_ECONOMY: "premium-economy",
        BUSINESS: "business",
        FIRST: "first",
      };
      args.push("--class", cabinMap[options.cabinClass]);
    }

    // Add max stops (fli uses: 0 for non-stop, 1, 2)
    if (options?.maxStops && options.maxStops !== "ANY") {
      const stopsMap: Record<MaxStops, string> = {
        ANY: "",
        NON_STOP: "0",
        ONE_STOP: "1",
        TWO_PLUS_STOPS: "2",
      };
      const stopsValue = stopsMap[options.maxStops];
      if (stopsValue) {
        args.push("--stops", stopsValue);
      }
    }

    // Add airline filter
    if (options?.airlines && options.airlines.length > 0) {
      args.push("--airlines", options.airlines.join(","));
    }

    // Add departure time window (fli uses --time HH-HH format)
    if (options?.departureTimeWindow) {
      args.push("--time", options.departureTimeWindow);
    }

    // Add passengers
    if (options?.passengers && options.passengers > 1) {
      args.push("--passengers", options.passengers.toString());
    }

    try {
      const result = await this.runFliCommand(args);

      if (!result.success) {
        console.error(`[fli] Search failed: ${result.error}`);
        return null;
      }

      if (!result.flights || result.flights.length === 0) {
        console.log(
          `[fli] No flights found for ${origin} -> ${destination} on ${date}`,
        );
        return null;
      }

      const cheapestFlight = result.flights[0];

      // Build Google Flights deep link
      const deepLink = this.buildGoogleFlightsUrl(
        origin,
        destination,
        date,
        options?.returnDate,
        options?.cabinClass,
        options?.passengers,
      );

      return {
        providerName: this.name,
        price: cheapestFlight.price,
        currency: cheapestFlight.currency || currency || this.currency,
        checkedAt: new Date().toISOString(),
        deepLink,
        departureDate: date,
        returnDate: options?.returnDate,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[fli] Error: ${error.message}`);
      } else {
        console.error(`[fli] Unknown error:`, error);
      }
      return null;
    }
  }

  async getCheapestFlightInRange(
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
    currency?: string,
    options?: FlightSearchOptions,
  ): Promise<ProviderFlightQuote | null> {
    const dates = this.getDateRange(startDate, endDate);

    if (dates.length === 0) {
      return null;
    }

    // If only one date, use the single-date method
    if (dates.length === 1) {
      return this.getCheapestFlight(origin, destination, dates[0], currency, options);
    }

    console.log(
      `[fli] Searching ${dates.length} dates for ${origin} -> ${destination} (${startDate} to ${endDate})`,
    );

    // Query all dates in parallel (with concurrency limit)
    const concurrencyLimit = 3;
    const quotes: ProviderFlightQuote[] = [];

    for (let i = 0; i < dates.length; i += concurrencyLimit) {
      const batch = dates.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map((date) =>
          this.getCheapestFlight(origin, destination, date, currency, options),
        ),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          quotes.push(result.value);
        }
      }
    }

    if (quotes.length === 0) {
      console.log(
        `[fli] No flights found for ${origin} -> ${destination} in date range ${startDate} to ${endDate}`,
      );
      return null;
    }

    // Find the cheapest quote across all dates
    const cheapestQuote = quotes.reduce((cheapest, current) => {
      return current.price < cheapest.price ? current : cheapest;
    });

    console.log(
      `[fli] Cheapest flight: ${cheapestQuote.price} ${cheapestQuote.currency} on ${cheapestQuote.departureDate}`,
    );

    return cheapestQuote;
  }

  /**
   * Generate array of dates between start and end (inclusive).
   * Respects maxDateRangeDays limit.
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from today if startDate is in the past
    const effectiveStart = start < today ? today : start;

    let current = new Date(effectiveStart);
    let count = 0;

    while (current <= end && count < this.maxDateRangeDays) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }

    if (count >= this.maxDateRangeDays && current <= end) {
      console.warn(
        `[fli] Date range truncated to ${this.maxDateRangeDays} days (original range: ${startDate} to ${endDate})`,
      );
    }

    return dates;
  }

  private runFliCommand(args: string[]): Promise<FliSearchResponse> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.fliPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: this.timeoutMs,
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        process.kill("SIGTERM");
        reject(new Error(`fli command timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      process.on("close", (code) => {
        clearTimeout(timeoutId);

        if (code !== 0) {
          // Check if fli is not installed
          if (stderr.includes("command not found") || stderr.includes("not found")) {
            reject(
              new Error(
                "fli CLI not found. Install it with: pipx install flights",
              ),
            );
            return;
          }
          reject(new Error(`fli exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout) as FliSearchResponse;
          resolve(result);
        } catch {
          reject(new Error(`Failed to parse fli output: ${stdout}`));
        }
      });

      process.on("error", (err) => {
        clearTimeout(timeoutId);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              "fli CLI not found. Install it with: pipx install flights",
            ),
          );
        } else {
          reject(err);
        }
      });
    });
  }

  async getCheapestDates(
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
    currency?: string,
    options?: CheapestDatesOptions,
  ): Promise<CheapestDatesResult | null> {
    const args = [
      "dates",
      origin.toUpperCase(),
      destination.toUpperCase(),
      "--from",
      startDate,
      "--to",
      endDate,
      "--format",
      "json",
      "--sort",  // Sort by price (cheapest first)
    ];

    // Add round-trip flag and duration
    if (options?.isRoundTrip) {
      args.push("--round");
      if (options.tripDuration && options.tripDuration > 0) {
        args.push("--duration", options.tripDuration.toString());
      }
    }

    // Add cabin class
    if (options?.cabinClass) {
      const cabinMap: Record<CabinClass, string> = {
        ECONOMY: "economy",
        PREMIUM_ECONOMY: "premium-economy",
        BUSINESS: "business",
        FIRST: "first",
      };
      args.push("--class", cabinMap[options.cabinClass]);
    }

    // Add max stops
    if (options?.maxStops && options.maxStops !== "ANY") {
      const stopsMap: Record<MaxStops, string> = {
        ANY: "",
        NON_STOP: "0",
        ONE_STOP: "1",
        TWO_PLUS_STOPS: "2",
      };
      const stopsValue = stopsMap[options.maxStops];
      if (stopsValue) {
        args.push("--stops", stopsValue);
      }
    }

    // Add airline filter
    if (options?.airlines && options.airlines.length > 0) {
      args.push("--airlines", options.airlines.join(","));
    }

    // Add departure time window
    if (options?.departureTimeWindow) {
      args.push("--time", options.departureTimeWindow);
    }

    // Add passengers
    if (options?.passengers && options.passengers > 1) {
      args.push("--passengers", options.passengers.toString());
    }

    try {
      const result = await this.runFliDatesCommand(args);

      if (!result.success) {
        console.error(`[fli] Dates search failed: ${result.error}`);
        return null;
      }

      if (!result.dates || result.dates.length === 0) {
        console.log(
          `[fli] No dates found for ${origin} -> ${destination} (${startDate} to ${endDate})`,
        );
        return null;
      }

      // Apply limit if specified
      const limit = options?.limit ?? 10;
      const limitedDates = result.dates.slice(0, limit);

      return {
        providerName: this.name,
        options: limitedDates.map((d) => ({
          departureDate: d.departure_date,
          returnDate: d.return_date,
          price: d.price,
          currency: d.currency || currency || this.currency,
        })),
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[fli] Dates error: ${error.message}`);
      } else {
        console.error(`[fli] Unknown dates error:`, error);
      }
      return null;
    }
  }

  private runFliDatesCommand(args: string[]): Promise<FliDatesResponse> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.fliPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: this.timeoutMs,
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        process.kill("SIGTERM");
        reject(new Error(`fli dates command timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      process.on("close", (code) => {
        clearTimeout(timeoutId);

        if (code !== 0) {
          if (stderr.includes("command not found") || stderr.includes("not found")) {
            reject(
              new Error(
                "fli CLI not found. Install it with: pipx install flights",
              ),
            );
            return;
          }
          reject(new Error(`fli dates exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout) as FliDatesResponse;
          resolve(result);
        } catch {
          reject(new Error(`Failed to parse fli dates output: ${stdout}`));
        }
      });

      process.on("error", (err) => {
        clearTimeout(timeoutId);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              "fli CLI not found. Install it with: pipx install flights",
            ),
          );
        } else {
          reject(err);
        }
      });
    });
  }

  private buildGoogleFlightsUrl(
    origin: string,
    destination: string,
    date: string,
    returnDate?: string,
    cabinClass?: CabinClass,
    passengers?: number,
  ): string {
    // Google Flights URL format with more parameters
    const params = new URLSearchParams();
    
    // Build the query string
    let query = `Flights to ${destination} from ${origin} on ${date}`;
    if (returnDate) {
      query += ` return ${returnDate}`;
    }
    params.set("q", query);

    // Add cabin class (Google Flights: 1=Economy, 2=Premium Economy, 3=Business, 4=First)
    if (cabinClass) {
      const tfsMap: Record<CabinClass, string> = {
        ECONOMY: "1",
        PREMIUM_ECONOMY: "2",
        BUSINESS: "3",
        FIRST: "4",
      };
      params.set("tfs", tfsMap[cabinClass]);
    }

    // Add passengers
    if (passengers && passengers > 1) {
      params.set("px", passengers.toString());
    }

    return `https://www.google.com/travel/flights?${params.toString()}`;
  }
}
