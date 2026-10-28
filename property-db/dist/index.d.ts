import type { PropertyFilter, QueryPropertyResult } from "./types.js";
export * from "./types.js";
export * from "./db.js";
export * from "./adapter.js";
export * from "./formatter.js";
export * from "./active.js";
export * from "./sold.js";
export * from "./market.js";
export declare function queryPropertyMls(args: {
    mode?: "active" | "sold" | "both" | "stats";
    filters?: Partial<PropertyFilter> | null;
    city?: string | null;
    page?: number;
    limit?: number;
    months?: number;
}): Promise<QueryPropertyResult | import("./types.js").MarketStatisticsResult>;
declare const _default: import("openclaw/plugin-sdk/tool-plugin").DefinedToolPluginEntry;
export default _default;
