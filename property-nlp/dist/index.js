import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
const NUMBER_WORDS = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
};
function parseNumberOrWord(val) {
    const lower = val.toLowerCase();
    if (NUMBER_WORDS[lower] !== undefined) {
        return NUMBER_WORDS[lower];
    }
    const n = Number(val.replace(/,/g, ""));
    return isNaN(n) ? null : n;
}
function createEmptyFilter() {
    return {
        city: null,
        maxPrice: null,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: null,
        pool: null,
        hasView: null,
        maxHOA: null,
    };
}
export async function parsePropertyQuery(query) {
    try {
        if (!query || typeof query !== "string" || !query.trim()) {
            return createEmptyFilter();
        }
        // 1. Parse HOA before price, and mask HOA match to prevent price regex collision
        const hoaRegex = /(?:hoa|association fee)(?:\s+(?:under|below|less than|max|of))?\s*\$?([\d,]+)/i;
        const hoaRegexAlt = /(?:under|below|max)\s*\$?([\d,]+)\s*(?:hoa|association fee)/i;
        const hoaMatch = query.match(hoaRegex) || query.match(hoaRegexAlt);
        let maxHOA = null;
        let queryForPrice = query;
        if (hoaMatch) {
            maxHOA = Number(hoaMatch[1].replace(/,/g, ""));
            queryForPrice = query.replace(hoaMatch[0], " ");
        }
        // 2. Parse Price
        const priceMatch = queryForPrice.match(/(?:under|below|less than|max|up to)\s*\$?([\d,.]+)\s*(k|m|million)?/i)
            || queryForPrice.match(/\$([\d,.]+)\s*(k|m|million)?/i);
        let maxPrice = null;
        if (priceMatch) {
            let val = Number(priceMatch[1].replace(/,/g, ""));
            const unit = priceMatch[2]?.toLowerCase();
            if (unit === "k")
                val *= 1_000;
            if (unit === "m" || unit === "million")
                val *= 1_000_000;
            maxPrice = !isNaN(val) ? val : null;
        }
        // 3. Parse Beds (supports N+, at least N, number words)
        const bedsMatch = query.match(/(?:at least\s+)?(\d+|one|two|three|four|five|six)\+?[\s-]*(?:bed|beds|bedroom|bedrooms)\b/i);
        let minBeds = null;
        if (bedsMatch) {
            minBeds = parseNumberOrWord(bedsMatch[1]);
        }
        // 4. Parse Baths (supports N+, fractional, number words, and "and a half")
        const bathsMatch = query.match(/(?:at least\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six)(?:\s+and\s+a\s+half)?\+?[\s-]*(?:bath|baths|bathroom|bathrooms)\b/i);
        let minBaths = null;
        if (bathsMatch) {
            const base = parseNumberOrWord(bathsMatch[1]);
            if (base !== null) {
                minBaths = /and\s+a\s+half/i.test(bathsMatch[0]) ? base + 0.5 : base;
            }
        }
        // 5. Parse Sq Ft (supports "at least", "N+", "sq ft", "sqft", "square feet")
        const sqftMatch = query.match(/(?:at least\s+|min(?:imum)?\s+)?([\d,]+)\+?[\s,]*(?:sqft|sq ft|square feet)\b/i);
        let minSqft = null;
        if (sqftMatch) {
            const val = Number(sqftMatch[1].replace(/,/g, ""));
            minSqft = !isNaN(val) ? val : null;
        }
        // 6. Parse Property Type
        const typePatterns = [
            [/\b(?:townhome|townhomes|townhouse|townhouses)\b/i, "Townhouse"],
            [/\b(?:single[\s-]*family|sfh|house|houses|home|homes)\b/i, "SingleFamilyResidence"],
            [/\b(?:condo|condos|condominium|condominiums)\b/i, "Condominium"],
            [/\b(?:land|lots?|unimproved\s*land)\b/i, "UnimprovedLand"],
        ];
        let propertyType = null;
        for (const [pattern, targetType] of typePatterns) {
            if (pattern.test(query)) {
                propertyType = targetType;
                break;
            }
        }
        // 7. Parse Pool and View
        const pool = /\bpool\b/i.test(query) ? "True" : null;
        const hasView = /\bview\b/i.test(query) ? "True" : null;
        // 8. Parse City
        const cityMatch = query.match(/(?:in|around)\s+([A-Za-z\s]+?)(?:\s+(?:under|with|at|for|having|\$)|,|$|\.)/i)
            || query.match(/in ([A-Za-z\s]+?)(?:\s+under|\s+with|\s+at|$)/i);
        let city = null;
        if (cityMatch) {
            const candidate = cityMatch[1].trim().replace(/[.,]$/, "");
            // Filter out non-city phrases or qualifiers
            if (candidate && !/^(?:at\s+least|\d|a\s+view|a\s+pool)/i.test(candidate)) {
                city = candidate;
            }
        }
        // Non-real-estate query safety guard:
        // If no real estate criteria matched, do not classify accidental text as a search
        const hasAnyRealEstateCriteria = propertyType !== null
            || maxPrice !== null
            || minBeds !== null
            || minBaths !== null
            || minSqft !== null
            || pool !== null
            || hasView !== null
            || maxHOA !== null;
        if (!hasAnyRealEstateCriteria) {
            return createEmptyFilter();
        }
        return {
            city,
            maxPrice,
            minBeds,
            minBaths,
            minSqft,
            type: propertyType,
            pool,
            hasView,
            maxHOA,
        };
    }
    catch {
        return createEmptyFilter();
    }
}
export default defineToolPlugin({
    id: "property-nlp",
    name: "Property NLP",
    description: "Natural language parser converting free-text property queries into structured database filters for rets_property.",
    tools: (tool) => [
        tool({
            name: "parse_property_query",
            description: "Extracts structured real estate filters from natural language. Note: minBeds, minBaths, and minSqft are minimum thresholds (>=); maxPrice and maxHOA are maximum thresholds (<=).",
            parameters: Type.Object({
                query: Type.String({
                    description: "Free-text real estate search query (e.g. '3 bed condo in Irvine under $1.5M with pool')",
                }),
            }),
            execute: async ({ query }) => {
                return await parsePropertyQuery(query);
            },
        }),
    ],
});
