import type { ActiveListingRow, SoldCompRow, FormattedActiveCard, FormattedSoldCard } from "./types.js";
export declare function formatActiveCard(row: ActiveListingRow): FormattedActiveCard;
export declare function formatSoldCard(row: SoldCompRow): FormattedSoldCard;
export declare function formatMarketSummaryCard(stats: Omit<import("./types.js").MarketStatistics, "text" | "mode">): string;
