import type { PropertyFilter, ActiveListingsResult } from "./types.js";
export declare function searchActiveListings(filters?: Partial<PropertyFilter> | null, page?: number, limit?: number): Promise<ActiveListingsResult>;
