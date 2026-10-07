export interface PropertyFilter {
    city: string | null;
    maxPrice: number | null;
    minBeds: number | null;
    minBaths: number | null;
    minSqft: number | null;
    type: string | null;
    pool: "True" | null;
    hasView: "True" | null;
    maxHOA: number | null;
}
export declare function parsePropertyQuery(query: string): Promise<PropertyFilter>;
declare const _default: import("openclaw/plugin-sdk/tool-plugin").DefinedToolPluginEntry;
export default _default;
