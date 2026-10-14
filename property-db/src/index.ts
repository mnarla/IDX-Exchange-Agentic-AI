import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { searchActiveListings } from "./active.js";
import { getSoldComps } from "./sold.js";
import type {
  PropertyFilter,
  QueryPropertyResult,
  BothListingsResult,
} from "./types.js";

export * from "./types.js";
export * from "./db.js";
export * from "./adapter.js";
export * from "./formatter.js";
export * from "./active.js";
export * from "./sold.js";

const PropertyFilterSchema = Type.Object(
  {
    city: Type.Union([Type.String(), Type.Null()]),
    maxPrice: Type.Union([Type.Number(), Type.Null()]),
    minBeds: Type.Union([Type.Number(), Type.Null()]),
    minBaths: Type.Union([Type.Number(), Type.Null()]),
    minSqft: Type.Union([Type.Number(), Type.Null()]),
    type: Type.Union([Type.String(), Type.Null()]),
    pool: Type.Union([Type.Literal("True"), Type.Null()]),
    hasView: Type.Union([Type.Literal("True"), Type.Null()]),
    maxHOA: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: true }
);

export async function queryPropertyMls(args: {
  mode?: "active" | "sold" | "both";
  filters?: Partial<PropertyFilter> | null;
  city?: string | null;
  page?: number;
  limit?: number;
  months?: number;
}): Promise<QueryPropertyResult> {
  const mode = args.mode || "active";
  const targetCity = args.city?.trim() || args.filters?.city?.trim() || null;

  if (mode === "sold" || mode === "both") {
    if (!targetCity) {
      return {
        error: "City is required to query sold comps. Please provide a city or search filters with a city specified.",
      };
    }
  }

  if (mode === "active") {
    const activeFilters = {
      ...(args.filters || {}),
      ...(targetCity ? { city: targetCity } : {}),
    };
    return await searchActiveListings(activeFilters, args.page, args.limit);
  }

  if (mode === "sold") {
    return await getSoldComps(targetCity!, args.months ?? 12);
  }

  // mode === "both"
  const activeFilters = {
    ...(args.filters || {}),
    city: targetCity!,
  };

  const [activeRes, soldRes] = await Promise.all([
    searchActiveListings(activeFilters, args.page, args.limit),
    getSoldComps(targetCity!, args.months ?? 12),
  ]);

  const bothText = `${activeRes.text}\n\n==============================\n\n${soldRes.text}`;

  const bothResult: BothListingsResult = {
    mode: "both",
    city: targetCity!,
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
  description: "MLS database query layer for active listings and sold comps, returning formatted property cards.",
  tools: (tool) => [
    tool({
      name: "query_property_mls",
      description: "Query active MLS listings (rets_property) and/or recent sold comps (california_sold). Returns structured data and formatted property cards.",
      parameters: Type.Object({
        mode: Type.Optional(
          Type.Union([Type.Literal("active"), Type.Literal("sold"), Type.Literal("both")], {
            description: "Query mode: 'active' for current listings, 'sold' for comps, or 'both'. Defaults to 'active'.",
          })
        ),
        filters: Type.Optional(
          PropertyFilterSchema
        ),
        city: Type.Optional(
          Type.String({
            description: "City name. Required for 'sold' and 'both' modes if not provided in filters.",
          })
        ),
        page: Type.Optional(
          Type.Number({
            description: "Page number for active listings (1-indexed). Defaults to 1.",
          })
        ),
        limit: Type.Optional(
          Type.Number({
            description: "Number of listings to return per page (1..50). Defaults to 10.",
          })
        ),
        months: Type.Optional(
          Type.Number({
            description: "Months window for sold comps query (defaults to 12).",
          })
        ),
      }),
      execute: async (params) => {
        return await queryPropertyMls(params);
      },
    }),
  ],
});
