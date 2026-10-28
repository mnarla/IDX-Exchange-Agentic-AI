import type { MonthlyTrendRawRow, MonthlyTrend, MarketStatisticsResult, MarketClimate } from "./types.js";
/**
 * Calculates exact median value from an array of numbers.
 * Handles both odd and even lengths cleanly.
 */
export declare function calculateMedian(numbers: number[]): number | null;
/**
 * Calculates Month-over-Month (MoM) and Year-over-Year (YoY) percentage changes.
 */
export declare function calculateMonthlyTrends(rawRows: MonthlyTrendRawRow[]): MonthlyTrend[];
/**
 * Determines market climate (Seller's, Buyer's, or Balanced)
 * based on months of inventory and list-to-close ratio.
 */
export declare function calculateMarketClimate(monthsOfInventory: number | null, listToClosePct: number | null, avgDom: number | null): MarketClimate;
export interface GetMarketStatisticsArgs {
    city: string;
    zip?: string | null;
    propertyType?: string | null;
    months?: number;
    includeTrends?: boolean;
}
export declare function getMarketStatistics(args: GetMarketStatisticsArgs): Promise<MarketStatisticsResult>;
