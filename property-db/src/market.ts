import { query } from "./db.js";
import { formatMarketSummaryCard } from "./formatter.js";
import type {
  MarketSummaryRawRow,
  MonthlyTrendRawRow,
  MonthlyTrend,
  MarketStatistics,
  MarketStatisticsResult,
  MarketClimate,
} from "./types.js";

/**
 * Calculates exact median value from an array of numbers.
 * Handles both odd and even lengths cleanly.
 */
export function calculateMedian(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Calculates Month-over-Month (MoM) and Year-over-Year (YoY) percentage changes.
 */
export function calculateMonthlyTrends(rawRows: MonthlyTrendRawRow[]): MonthlyTrend[] {
  if (!rawRows || rawRows.length === 0) return [];

  // Map by month string for fast lookup (e.g. "2026-05")
  const monthMap = new Map<string, MonthlyTrendRawRow>();
  for (const r of rawRows) {
    monthMap.set(r.month, r);
  }

  const trends: MonthlyTrend[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const prevRow = i > 0 ? rawRows[i - 1] : null;

    // MoM change
    let priceChangePct: number | null = null;
    if (prevRow && prevRow.avg_price && row.avg_price) {
      priceChangePct =
        Math.round(((row.avg_price - prevRow.avg_price) / prevRow.avg_price) * 1000) / 10;
    }

    // YoY change (match month 12 months earlier, e.g. "2026-05" -> "2025-05")
    let yoyPriceChangePct: number | null = null;
    const [yearStr, mStr] = row.month.split("-");
    const prevYear = Number(yearStr) - 1;
    const yoyKey = `${prevYear}-${mStr}`;
    const yoyRow = monthMap.get(yoyKey);
    if (yoyRow && yoyRow.avg_price && row.avg_price) {
      yoyPriceChangePct =
        Math.round(((row.avg_price - yoyRow.avg_price) / yoyRow.avg_price) * 1000) / 10;
    }

    trends.push({
      month: row.month,
      sales: Number(row.sales) || 0,
      avgPrice: row.avg_price !== null ? Number(row.avg_price) : null,
      avgPricePerSqft: row.avg_price_per_sqft !== null ? Number(row.avg_price_per_sqft) : null,
      avgDom: row.avg_dom !== null ? Number(row.avg_dom) : null,
      listToClosePct: row.list_to_close_pct !== null ? Number(row.list_to_close_pct) : null,
      priceChangePct,
      yoyPriceChangePct,
    });
  }

  return trends;
}

/**
 * Determines market climate (Seller's, Buyer's, or Balanced)
 * based on months of inventory and list-to-close ratio.
 */
export function calculateMarketClimate(
  monthsOfInventory: number | null,
  listToClosePct: number | null,
  avgDom: number | null
): MarketClimate {
  if (monthsOfInventory !== null) {
    if (monthsOfInventory < 3) return "Seller's Market";
    if (monthsOfInventory > 6) return "Buyer's Market";
    return "Balanced Market";
  }

  if (listToClosePct !== null) {
    if (listToClosePct >= 100.5) return "Seller's Market";
    if (listToClosePct < 98) return "Buyer's Market";
  }

  if (avgDom !== null) {
    if (avgDom < 30) return "Seller's Market";
    if (avgDom > 60) return "Buyer's Market";
  }

  return "Balanced Market";
}

export interface GetMarketStatisticsArgs {
  city: string;
  zip?: string | null;
  propertyType?: string | null;
  months?: number;
  includeTrends?: boolean;
}

export async function getMarketStatistics(
  args: GetMarketStatisticsArgs
): Promise<MarketStatisticsResult> {
  const cleanCity = args.city?.trim();
  if (!cleanCity) {
    return {
      error: "City is required to query market statistics. Please provide a city.",
    };
  }

  const safeMonths = Math.max(1, Math.min(120, Math.floor(Number(args.months) || 12)));
  const propertyType = args.propertyType?.trim() || "Residential";
  const cleanZip = args.zip?.trim() || null;
  const includeTrends = args.includeTrends !== false;

  // 1. City Summary Aggregates (california_sold)
  let summarySql = `
SELECT
  City,
  COUNT(*)                                              AS sold_count,
  ROUND(AVG(ClosePrice), 0)                             AS avg_close_price,
  ROUND(AVG(ClosePrice / NULLIF(LivingArea,0)),0)       AS avg_price_per_sqft,
  ROUND(AVG(DaysOnMarket), 1)                           AS avg_dom,
  ROUND(AVG(ClosePrice / NULLIF(ListPrice,0)) * 100, 1) AS list_to_close_pct
FROM california_sold
WHERE City = ?
  AND PropertyType = ?
  AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
  `.trim();

  const summaryParams: any[] = [cleanCity, propertyType, safeMonths];

  if (cleanZip) {
    summarySql += ` AND (PostalCode = ? OR PostalCode LIKE ?)`;
    summaryParams.push(cleanZip, `${cleanZip}%`);
  }

  summarySql += ` GROUP BY City`;

  // 2. Query ClosePrices for Exact Median (california_sold)
  let pricesSql = `
SELECT ClosePrice
FROM california_sold
WHERE City = ?
  AND PropertyType = ?
  AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
  AND ClosePrice IS NOT NULL
  `.trim();

  const pricesParams: any[] = [cleanCity, propertyType, safeMonths];
  if (cleanZip) {
    pricesSql += ` AND (PostalCode = ? OR PostalCode LIKE ?)`;
    pricesParams.push(cleanZip, `${cleanZip}%`);
  }
  pricesSql += ` ORDER BY ClosePrice ASC`;

  // 3. Active Listings Count (rets_property)
  let activeSql = `
SELECT COUNT(*) AS active_count
FROM rets_property
WHERE L_City = ? AND L_Status = ?
  `.trim();
  const activeParams: any[] = [cleanCity, "Active"];
  if (cleanZip) {
    activeSql += ` AND L_Zip = ?`;
    activeParams.push(cleanZip);
  }

  // 4. Monthly Trends Query (california_sold)
  let trendsSql = `
SELECT
  DATE_FORMAT(CloseDate, "%Y-%m")                       AS month,
  COUNT(*)                                              AS sales,
  ROUND(AVG(ClosePrice), 0)                             AS avg_price,
  ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0)     AS avg_price_per_sqft,
  ROUND(AVG(DaysOnMarket), 1)                           AS avg_dom,
  ROUND(AVG(ClosePrice / NULLIF(ListPrice, 0)) * 100, 1) AS list_to_close_pct
FROM california_sold
WHERE City = ?
  AND PropertyType = ?
  AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
  `.trim();

  const trendsParams: any[] = [cleanCity, propertyType, safeMonths];
  if (cleanZip) {
    trendsSql += ` AND (PostalCode = ? OR PostalCode LIKE ?)`;
    trendsParams.push(cleanZip, `${cleanZip}%`);
  }
  trendsSql += ` GROUP BY DATE_FORMAT(CloseDate, "%Y-%m") ORDER BY month ASC`;

  // Execute queries in parallel
  const [summaryRows, priceRows, activeRows, trendRows] = await Promise.all([
    query<MarketSummaryRawRow>(summarySql, summaryParams),
    query<{ ClosePrice: number }>(pricesSql, pricesParams),
    query<{ active_count: number }>(activeSql, activeParams),
    includeTrends ? query<MonthlyTrendRawRow>(trendsSql, trendsParams) : Promise.resolve([]),
  ]);

  const summary = summaryRows[0];
  const soldCount = summary ? Number(summary.sold_count) || 0 : 0;
  const avgClosePrice = summary?.avg_close_price !== null && summary?.avg_close_price !== undefined
    ? Number(summary.avg_close_price)
    : null;
  const avgPricePerSqft = summary?.avg_price_per_sqft !== null && summary?.avg_price_per_sqft !== undefined
    ? Number(summary.avg_price_per_sqft)
    : null;
  const avgDom = summary?.avg_dom !== null && summary?.avg_dom !== undefined
    ? Number(summary.avg_dom)
    : null;
  const listToClosePct = summary?.list_to_close_pct !== null && summary?.list_to_close_pct !== undefined
    ? Number(summary.list_to_close_pct)
    : null;

  // Calculate Median
  const closePrices = priceRows.map((r) => Number(r.ClosePrice)).filter((p) => !isNaN(p));
  const medianClosePrice = calculateMedian(closePrices);

  // Active Count & Months of Inventory (Inventory Comparison)
  const activeCount = activeRows[0]?.active_count !== undefined
    ? Number(activeRows[0].active_count)
    : null;

  let monthsOfInventory: number | null = null;
  if (soldCount > 0 && activeCount !== null) {
    const monthlySalesRate = soldCount / safeMonths;
    if (monthlySalesRate > 0) {
      monthsOfInventory = Math.round((activeCount / monthlySalesRate) * 10) / 10;
    }
  }

  // Market climate assessment
  const marketType = calculateMarketClimate(monthsOfInventory, listToClosePct, avgDom);

  // Calculate Monthly Trends
  const trends = calculateMonthlyTrends(trendRows);

  const statsPayload = {
    city: cleanCity,
    zip: cleanZip,
    propertyType,
    months: safeMonths,
    soldCount,
    avgClosePrice,
    medianClosePrice,
    avgPricePerSqft,
    avgDom,
    listToClosePct,
    activeCount,
    monthsOfInventory,
    marketType,
    trends,
  };

  const cardText = formatMarketSummaryCard(statsPayload);

  const result: MarketStatistics = {
    mode: "stats",
    ...statsPayload,
    text: cardText,
  };

  return result;
}
