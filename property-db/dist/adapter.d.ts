import type { PropertyFilter } from "./types.js";
export interface AdaptedFilterResult {
    whereClause: string;
    params: any[];
}
/**
 * Maps Week 2 structured PropertyFilter to rets_property WHERE conditions and parameter array.
 * Note: Zero string interpolation is performed. Every filter value is parameterized with `?`.
 */
export declare function adaptFiltersToSQL(filters?: Partial<PropertyFilter> | null): AdaptedFilterResult;
