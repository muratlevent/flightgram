/**
 * ASCII chart service for rendering price history as text-based visualizations.
 */

// Unicode block characters for sparkline (8 levels)
const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export interface PriceDataPoint {
  date: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
}

export interface ChartResult {
  sparkline: string;
  summary: string;
  details: string;
}

/**
 * Generate a sparkline chart from price data points.
 */
export function generateSparkline(prices: number[]): string {
  if (prices.length === 0) {
    return "";
  }

  if (prices.length === 1) {
    return SPARKLINE_CHARS[4]; // Middle height for single point
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  if (range === 0) {
    // All prices are the same
    return SPARKLINE_CHARS[4].repeat(prices.length);
  }

  return prices
    .map((price) => {
      const normalized = (price - min) / range;
      const index = Math.min(
        Math.floor(normalized * SPARKLINE_CHARS.length),
        SPARKLINE_CHARS.length - 1,
      );
      return SPARKLINE_CHARS[index];
    })
    .join("");
}

/**
 * Generate a full price history chart with sparkline, summary, and details.
 */
export function generatePriceHistoryChart(
  dataPoints: PriceDataPoint[],
  currency: string,
  targetPrice: number,
): ChartResult {
  if (dataPoints.length === 0) {
    return {
      sparkline: "",
      summary: "No price history available yet.",
      details: "",
    };
  }

  const prices = dataPoints.map((dp) => dp.minPrice);
  const sparkline = generateSparkline(prices);

  // Calculate statistics
  const currentPrice = prices[prices.length - 1];
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Calculate trend
  const firstPrice = prices[0];
  const priceChange = currentPrice - firstPrice;
  const percentChange = ((priceChange / firstPrice) * 100).toFixed(1);
  const trendEmoji = priceChange < 0 ? "↓" : priceChange > 0 ? "↑" : "→";
  const trendText = priceChange < 0 ? "down" : priceChange > 0 ? "up" : "stable";

  // Format dates for range
  const startDate = formatShortDate(dataPoints[0].date);
  const endDate = formatShortDate(dataPoints[dataPoints.length - 1].date);
  const dateRange = dataPoints.length > 1 ? `${startDate} - ${endDate}` : startDate;

  // Build summary
  const summaryLines = [
    `${trendEmoji} ${Math.abs(Number(percentChange))}% ${trendText} over ${dataPoints.length} day(s)`,
    `Period: ${dateRange}`,
  ];

  // Build details
  const detailLines = [
    `Current: ${formatPrice(currentPrice, currency)}`,
    `Lowest:  ${formatPrice(lowestPrice, currency)}`,
    `Highest: ${formatPrice(highestPrice, currency)}`,
    `Average: ${formatPrice(avgPrice, currency)}`,
    `Target:  ${formatPrice(targetPrice, currency)}`,
  ];

  // Add status vs target
  if (currentPrice <= targetPrice) {
    detailLines.push("Status:  Below target!");
  } else {
    const abovePercent = ((currentPrice - targetPrice) / targetPrice * 100).toFixed(0);
    detailLines.push(`Status:  ${abovePercent}% above target`);
  }

  return {
    sparkline,
    summary: summaryLines.join("\n"),
    details: detailLines.join("\n"),
  };
}

/**
 * Generate a bar chart representation (vertical bars with labels).
 */
export function generateBarChart(
  dataPoints: PriceDataPoint[],
  currency: string,
  maxBars: number = 10,
): string {
  if (dataPoints.length === 0) {
    return "No data available.";
  }

  // Sample data if too many points
  const sampled = sampleDataPoints(dataPoints, maxBars);
  const prices = sampled.map((dp) => dp.minPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const barHeight = 5; // Number of rows for the bar chart
  const lines: string[] = [];

  // Build chart rows from top to bottom
  for (let row = barHeight - 1; row >= 0; row--) {
    const threshold = min + (range * (row + 1)) / barHeight;
    const rowChars = sampled.map((dp) => (dp.minPrice >= threshold ? "█" : " "));
    lines.push(rowChars.join(" "));
  }

  // Add date labels
  const dateLabels = sampled.map((dp) => formatShortDate(dp.date).slice(5)); // MM-DD
  lines.push("─".repeat(sampled.length * 2 - 1));
  lines.push(dateLabels.join(" "));

  // Add price scale on the right
  const priceScale = [
    `Max: ${formatPrice(max, currency)}`,
    `Min: ${formatPrice(min, currency)}`,
  ];

  return lines.join("\n") + "\n" + priceScale.join(" | ");
}

function formatShortDate(isoDate: string): string {
  // Handle both "YYYY-MM-DD" and ISO timestamp formats
  const datePart = isoDate.split("T")[0];
  return datePart;
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function sampleDataPoints(
  dataPoints: PriceDataPoint[],
  maxPoints: number,
): PriceDataPoint[] {
  if (dataPoints.length <= maxPoints) {
    return dataPoints;
  }

  const step = (dataPoints.length - 1) / (maxPoints - 1);
  const sampled: PriceDataPoint[] = [];

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    sampled.push(dataPoints[index]);
  }

  return sampled;
}
