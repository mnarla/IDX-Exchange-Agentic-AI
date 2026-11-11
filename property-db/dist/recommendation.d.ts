import type { ActiveListingRow, PropertyFilter } from "./types.js";
export declare function calculateSimilarityScore(target: ActiveListingRow, candidate: ActiveListingRow, targetEmb: number[], candidateEmb: number[]): {
    price: number;
    beds: number;
    city: number;
    sqft: number;
    structured: number;
    semantic: number;
    total: number;
};
export declare function validateWithComps(city: string | null, sqft: number | null, price: number | null): Promise<{
    status: "insufficient_data";
    compPrice: number | null;
    listPrice: number | null;
    deltaPct: number | null;
    compCount: number;
    months: number;
    source: string;
} | {
    status: "available";
    compPrice: number;
    compCount: number;
    deltaPct: number;
    listPrice: number | null;
    months: number;
    source: string;
}>;
export declare function recommendProperties(options: {
    listingId: string;
    topK?: number;
    filters?: Partial<PropertyFilter>;
}): Promise<{
    error: string;
    mode?: undefined;
    appliedFilters?: undefined;
    listingId?: undefined;
    resultsCount?: undefined;
    matches?: undefined;
    text?: undefined;
    candidateCount?: undefined;
    candidateLimit?: undefined;
} | {
    mode: string;
    appliedFilters: Partial<PropertyFilter>;
    listingId: string;
    resultsCount: number;
    matches: never[];
    text: string;
    error?: undefined;
    candidateCount?: undefined;
    candidateLimit?: undefined;
} | {
    mode: string;
    appliedFilters: Partial<PropertyFilter>;
    listingId: string;
    resultsCount: number;
    candidateCount: number;
    candidateLimit: number;
    matches: {
        rank: number;
        listingId: string;
        score: {
            price: number;
            beds: number;
            city: number;
            sqft: number;
            structured: number;
            semantic: number;
            total: number;
        };
        reasons: string[];
        card: import("./types.js").FormattedActiveCard;
        comps: {
            status: "insufficient_data";
            compPrice: number | null;
            listPrice: number | null;
            deltaPct: number | null;
            compCount: number;
            months: number;
            source: string;
        } | {
            status: "available";
            compPrice: number;
            compCount: number;
            deltaPct: number;
            listPrice: number | null;
            months: number;
            source: string;
        };
    }[];
    text: string;
    error?: undefined;
}>;
