import { query } from "./db.js";
import { adaptFiltersToSQL } from "./adapter.js";
import { formatActiveCard } from "./formatter.js";
import type { PropertyFilter, ActiveListingRow, ActiveListingsResult } from "./types.js";

export async function searchActiveListings(
  filters?: Partial<PropertyFilter> | null,
  page: number = 1,
  limit: number = 10
): Promise<ActiveListingsResult> {
  const rawPage = Number(page);
  const safePage = Math.max(1, Math.floor(isNaN(rawPage) ? 1 : rawPage));
  const rawLimit = Number(limit);
  const safeLimit = Math.min(50, Math.max(1, Math.floor(isNaN(rawLimit) ? 10 : rawLimit)));
  const offset = (safePage - 1) * safeLimit;

  const { whereClause, params } = adaptFiltersToSQL(filters);

  // Fetch safeLimit + 1 rows to detect hasMore efficiently without COUNT(*)
  const fetchLimit = safeLimit + 1;

  const sql = `
SELECT
  L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
  L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths, LM_Int2_3 AS sqft,
  L_Type_ AS type, L_Status AS status,
  LMD_MP_Latitude AS lat, LMD_MP_Longitude AS lng,
  YearBuilt, AssociationFee, DaysOnMarket,
  PoolPrivateYN, ViewYN, FireplaceYN, PhotoCount,
  LA1_UserFirstName, LA1_UserLastName, LO1_OrganizationName
FROM rets_property
${whereClause}
ORDER BY L_SystemPrice ASC, L_ListingID ASC
LIMIT ? OFFSET ?
  `.trim();

  const queryParams = [...params, fetchLimit, offset];
  const rows = await query<ActiveListingRow>(sql, queryParams);

  const hasMore = rows.length > safeLimit;
  const slicedRows = hasMore ? rows.slice(0, safeLimit) : rows;
  const cards = slicedRows.map(formatActiveCard);

  const textHeader = `🏠 Found ${cards.length} active listing${cards.length === 1 ? "" : "s"} (Page ${safePage}):\n\n`;
  const cardsText = cards.map((c, i) => `[Listing ${i + 1}]\n${c.text}`).join("\n\n---\n\n");
  const fullText = cards.length > 0 ? `${textHeader}${cardsText}` : "No active listings found matching criteria.";

  return {
    mode: "active",
    page: safePage,
    limit: safeLimit,
    hasMore,
    cards,
    text: fullText,
  };
}
