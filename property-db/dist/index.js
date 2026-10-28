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
import { getMarketStatistics } from "./market.js";
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
            name: "query_property_mls",
            description: "Query active MLS listings (rets_property) and/or recent sold comps (california_sold). Returns structured data and formatted property cards.",
            parameters: Type.Object({
                mode: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("sold"), Type.Literal("both"), Type.Literal("stats")], {
                    description: "Query mode: 'active' for current listings, 'sold' for comps, 'both', or 'stats' for market statistics. Defaults to 'active'.",
                })),
                filters: Type.Optional(PropertyFilterSchema),
                city: Type.Optional(Type.String({
                    description: "City name. Required for 'sold', 'both', and 'stats' modes if not provided in filters.",
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
    ],
});
