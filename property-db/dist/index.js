import { searchRealEstateKnowledge } from "./knowledge.js";
export * from "./knowledge.js";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { searchActiveListings } from "./active.js";
import { getSoldComps } from "./sold.js";
export * from "./types.js";
export * from "./db.js";
export * from "./adapter.js";
export * from "./formatter.js";
export * from "./active.js";
export * from "./sold.js";
export * from "./market.js";
export * from "./vector.js";
export * from "./recommendation.js";
import { recommendProperties } from "./recommendation.js";
import { getMarketStatistics } from "./market.js";
import { searchSimilarProperties } from "./vector.js";
const PropertyFilterSchema = Type.Object({
    city: Type.Union([Type.String(), Type.Null()]),
    maxPrice: Type.Union([Type.Number(), Type.Null()]),
    minBeds: Type.Union([Type.Number(), Type.Null()]),
    minBaths: Type.Union([Type.Number(), Type.Null()]),
    minSqft: Type.Union([Type.Number(), Type.Null()]),
    type: Type.Union([Type.String(), Type.Null()]),
    pool: Type.Union([Type.Literal("True"), Type.Null()]),
    hasView: Type.Union([Type.Literal("True"), Type.Null()]),
    maxHOA: Type.Union([Type.Number(), Type.Null()]),
}, { additionalProperties: true });
export async function queryPropertyMls(args) {
    const mode = args.mode || "active";
    const targetCity = args.city?.trim() || args.filters?.city?.trim() || null;
    if (mode === "semantic") {
        const semanticQuery = args.query?.trim() || targetCity || "";
        return await searchSimilarProperties({
            query: semanticQuery,
            topK: args.limit ?? 5,
            city: targetCity,
            maxPrice: args.filters?.maxPrice ?? null,
            minBeds: args.filters?.minBeds ?? null,
            type: args.filters?.type ?? null,
        });
    }
    if (mode === "sold" || mode === "both" || mode === "stats") {
        if (!targetCity) {
            return {
                error: "City is required to query sold comps or market statistics. Please provide a city or search filters with a city specified.",
            };
        }
    }
    if (mode === "stats") {
        return await getMarketStatistics({
            city: targetCity,
            months: args.months ?? 12,
        });
    }
    if (mode === "active") {
        const activeFilters = {
            ...(args.filters || {}),
            ...(targetCity ? { city: targetCity } : {}),
        };
        return await searchActiveListings(activeFilters, args.page, args.limit);
    }
    if (mode === "sold") {
        return await getSoldComps(targetCity, args.months ?? 12);
    }
    // mode === "both"
    const activeFilters = {
        ...(args.filters || {}),
        city: targetCity,
    };
    const [activeRes, soldRes] = await Promise.all([
        searchActiveListings(activeFilters, args.page, args.limit),
        getSoldComps(targetCity, args.months ?? 12),
    ]);
    const bothText = `${activeRes.text}\n\n==============================\n\n${soldRes.text}`;
    const bothResult = {
        mode: "both",
        city: targetCity,
        active: {
            page: activeRes.page,
            limit: activeRes.limit,
            hasMore: activeRes.hasMore,
            cards: activeRes.cards,
        },
        sold: {
            months: soldRes.months,
            cards: soldRes.cards,
        },
        text: bothText,
    };
    return bothResult;
}
export default defineToolPlugin({
    id: "property-db",
    name: "Property DB",
    description: "MLS database query layer for active listings, sold comps, and market analytics.",
    tools: (tool) => [
        tool({
            name: "search_real_estate_knowledge",
            description: "Retrieve source passages for real estate definitions, MLS table columns, and documented market reports. Answer with source citations; do not invent unsupported facts.",
            parameters: Type.Object({ query: Type.String({ minLength: 1, maxLength: 4000 }), topK: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })) }),
            execute: async (params) => await searchRealEstateKnowledge(params),
        }),
        tool({
            name: "query_property_mls",
            description: "Query active MLS listings (rets_property) and/or recent sold comps (california_sold). Returns structured data and formatted property cards.",
            parameters: Type.Object({
                mode: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("sold"), Type.Literal("both"), Type.Literal("stats"), Type.Literal("semantic")], {
                    description: "Query mode: 'active' for current listings, 'sold' for comps, 'both', 'stats' for market statistics, or 'semantic' for vector similarity. Defaults to 'active'.",
                })),
                filters: Type.Optional(PropertyFilterSchema),
                city: Type.Optional(Type.String({
                    description: "City name. Required for 'sold', 'both', and 'stats' modes if not provided in filters.",
                })),
                query: Type.Optional(Type.String({
                    description: "Free-text description used when mode is 'semantic'.",
                })),
                page: Type.Optional(Type.Number({
                    description: "Page number for active listings (1-indexed). Defaults to 1.",
                })),
                limit: Type.Optional(Type.Number({
                    description: "Number of listings to return per page (1..50). Defaults to 10.",
                })),
                months: Type.Optional(Type.Number({
                    description: "Months window for sold comps query (defaults to 12).",
                })),
            }),
            execute: async (params) => {
                return await queryPropertyMls(params);
            },
        }),
        tool({
            name: "get_market_statistics",
            description: "Get real estate market analytics, historical trends, median price, price/sqft, DOM, list-to-close ratio, and active inventory comparison for any California city or zip code.",
            parameters: Type.Object({
                city: Type.String({
                    description: "City name in California (e.g. 'Pasadena', 'San Diego', 'Irvine').",
                }),
                zip: Type.Optional(Type.String({
                    description: "Optional 5-digit ZIP code to narrow statistics.",
                })),
                propertyType: Type.Optional(Type.String({
                    description: "Property type filter (e.g. 'Residential', 'SingleFamilyResidence', 'Condominium'). Defaults to 'Residential'.",
                })),
                months: Type.Optional(Type.Number({
                    description: "Lookback window in months (e.g. 12 or 24). Defaults to 12.",
                })),
                includeTrends: Type.Optional(Type.Boolean({
                    description: "Whether to include monthly price trend series and MoM/YoY calculations. Defaults to true.",
                })),
            }),
            execute: async (params) => {
                return await getMarketStatistics(params);
            },
        }),
        tool({
            name: "semantic_property_search",
            description: "Search active MLS listings (rets_property) by semantic similarity using OpenAI embeddings. Matches listing remarks with qualitative, aesthetic, and architectural preferences (e.g. 'charming craftsman with mountain views and character'). Returns top 5 most similar listings.",
            parameters: Type.Object({
                query: Type.String({
                    description: "Free-text description of desired property features, architectural style, or vibe.",
                }),
                topK: Type.Optional(Type.Number({
                    description: "Number of top similar listings to return (defaults to 5).",
                })),
                city: Type.Optional(Type.String({
                    description: "Optional city to restrict semantic search (e.g. 'Pasadena', 'Irvine').",
                })),
                maxPrice: Type.Optional(Type.Number({
                    description: "Optional maximum price filter.",
                })),
                minBeds: Type.Optional(Type.Number({
                    description: "Optional minimum bedrooms filter.",
                })),
                type: Type.Optional(Type.String({
                    description: "Optional property type (e.g. 'SingleFamilyResidence', 'Condominium').",
                })),
            }),
            execute: async (params) => {
                return await searchSimilarProperties(params);
            },
        }),
        tool({
            name: "recommend_properties",
            description: "Recommend up to five similar active listings from a liked listing ID using structured and embedding similarity, with recent sold-comp price comparisons. If the user requests homes in a city, ALWAYS pass filters.city; the liked listing ID alone does not restrict location. Preserve returned ranks and do not invent inventory counts or nearby locations.",
            parameters: Type.Object({
                listingId: Type.String({ minLength: 1, description: "L_ListingID of the listing the user likes." }),
                topK: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, default: 5 })),
                filters: Type.Optional(Type.Partial(PropertyFilterSchema)),
            }),
            execute: async (params) => await recommendProperties(params),
        }),
    ],
});
