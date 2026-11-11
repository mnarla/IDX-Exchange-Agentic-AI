import { query } from "./db.js";
import { adaptFiltersToSQL } from "./adapter.js";
import { formatActiveCard } from "./formatter.js";
import { buildListingEmbeddingText, cosineSimilarity, getEmbedding } from "./vector.js";
import type { ActiveListingRow, PropertyFilter } from "./types.js";

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function calculateSimilarityScore(target: ActiveListingRow, candidate: ActiveListingRow, targetEmb: number[], candidateEmb: number[]) {
  if (targetEmb.length !== candidateEmb.length || [...targetEmb, ...candidateEmb].some(n => !Number.isFinite(n))) {
    throw new Error("Incompatible embedding vectors.");
  }
  const priceA = numeric(target.price), priceB = numeric(candidate.price);
  const sqftA = numeric(target.sqft), sqftB = numeric(candidate.sqft);
  const bedsA = numeric(target.beds), bedsB = numeric(candidate.beds);
  const priceDiff = priceA && priceB ? Math.abs(priceA - priceB) : Infinity;
  const sqftDiff = sqftA && sqftB ? Math.abs(sqftA - sqftB) : Infinity;
  const price = priceDiff < 50000 ? 20 : priceDiff < 150000 ? 12 : priceDiff < 300000 ? 5 : 0;
  const beds = bedsA !== null && bedsB !== null && bedsA === bedsB ? 15 : 0;
  const city = target.L_City?.trim() && target.L_City.trim().toLowerCase() === candidate.L_City?.trim().toLowerCase() ? 15 : 0;
  const sqft = sqftDiff < 300 ? 10 : sqftDiff < 700 ? 5 : 0;
  const semantic = cosineSimilarity(targetEmb, candidateEmb) * 40;
  const structured = price + beds + city + sqft;
  return { price, beds, city, sqft, structured, semantic: Math.round(semantic * 100) / 100, total: Math.round((structured + semantic) * 100) / 100 };
}

export async function validateWithComps(city: string | null, sqft: number | null, price: number | null) {
  const area = numeric(sqft), asking = numeric(price);
  const empty = { status: "insufficient_data" as const, compPrice: null as number | null, listPrice: asking, deltaPct: null as number | null, compCount: 0, months: 6, source: "california_sold" };
  if (!city?.trim() || !area || !asking) return empty;
  const rows = await query<{avg_ppsf: number | string | null; comp_count: number | string}>(`
SELECT AVG(ClosePrice / NULLIF(LivingArea, 0)) AS avg_ppsf, COUNT(*) AS comp_count
FROM california_sold
WHERE City = ? AND PropertyType = 'Residential'
  AND LivingArea BETWEEN ? AND ? AND LivingArea > 0 AND ClosePrice > 0
  AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
  AND CloseDate <= CURDATE()`, [city.trim(), area * 0.8, area * 1.2]);
  const avg = numeric(rows[0]?.avg_ppsf), count = numeric(rows[0]?.comp_count) ?? 0;
  if (!avg || !count) return empty;
  const estimate = avg * area;
  return { ...empty, status: "available" as const, compPrice: Math.round(estimate), compCount: count, deltaPct: Math.round((asking - estimate) / estimate * 1000) / 10 };
}

const columns = `L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths, LM_Int2_3 AS sqft,
L_Type_ AS type, L_Status AS status, L_Remarks, YearBuilt, AssociationFee, DaysOnMarket,
PoolPrivateYN, ViewYN, FireplaceYN, PhotoCount, LA1_UserFirstName, LA1_UserLastName, LO1_OrganizationName`;

export async function recommendProperties(options: {listingId: string; topK?: number; filters?: Partial<PropertyFilter>}) {
  const topK = options.topK ?? 5;
  if (!options.listingId?.trim() || !Number.isInteger(topK) || topK < 1 || topK > 5) return { error: "Provide a listingId and an integer topK from 1 to 5." };
  try {
    const [target] = await query<ActiveListingRow>(`SELECT ${columns} FROM rets_property WHERE L_ListingID = ? LIMIT 1`, [options.listingId.trim()]);
    if (!target) return { error: "Liked listing was not found." };
    const { whereClause, params } = adaptFiltersToSQL(options.filters);
    // Bounded shortlist: rank by the handbook's structured score before embedding.
    const candidates = await query<ActiveListingRow>(`SELECT ${columns} FROM rets_property
${whereClause} AND L_Status = 'Active' AND L_ListingID <> ?
ORDER BY (
 CASE WHEN ABS(L_SystemPrice - ?) < 50000 THEN 20 WHEN ABS(L_SystemPrice - ?) < 150000 THEN 12 WHEN ABS(L_SystemPrice - ?) < 300000 THEN 5 ELSE 0 END
 + CASE WHEN L_Keyword2 = ? THEN 15 ELSE 0 END
 + CASE WHEN LOWER(L_City) = LOWER(?) THEN 15 ELSE 0 END
 + CASE WHEN ABS(LM_Int2_3 - ?) < 300 THEN 10 WHEN ABS(LM_Int2_3 - ?) < 700 THEN 5 ELSE 0 END
) DESC, L_ListingID ASC
LIMIT 100`, [...params, target.L_ListingID, target.price, target.price, target.price, target.beds, target.L_City, target.sqft, target.sqft]);
    const eligible = candidates.filter(r => r.L_ListingID !== target.L_ListingID && r.status === "Active");
    if (!eligible.length) return { mode: "recommendation", listingId: target.L_ListingID, resultsCount: 0, matches: [], text: "No other active listings match your constraints." };
    const targetEmb = await getEmbedding(buildListingEmbeddingText(target));
    if (!targetEmb.length || !targetEmb.some(n => n !== 0)) throw new Error("Target embedding is empty or zero.");
    const ranked = [];
    for (const row of eligible) {
      const emb = await getEmbedding(buildListingEmbeddingText(row));
      if (!emb.length || !emb.some(n => n !== 0)) throw new Error("Candidate embedding is empty or zero.");
      ranked.push({row, score: calculateSimilarityScore(target, row, targetEmb, emb)});
    }
    ranked.sort((a,b) => b.score.total - a.score.total || a.row.L_ListingID.localeCompare(b.row.L_ListingID));
    const matches = [];
    for (const {row, score} of ranked.slice(0, topK)) {
      const comps = await validateWithComps(row.L_City, row.sqft, row.price);
      const reasons = [score.price ? "Similar price" : "", score.beds ? "Same bedroom count" : "", score.city ? "Same city" : "", score.sqft ? "Similar living area" : ""].filter(Boolean);
      matches.push({listingId: row.L_ListingID, score, reasons, card: formatActiveCard(row), comps});
    }
    const text = matches.map((m,i) => `[Recommendation ${i+1}] — Similarity score: ${m.score.total.toFixed(2)}\n${m.card.text}\n${m.reasons.join(" • ")}\n${m.comps.status === "available" ? `Recent-sales estimate: $${m.comps.compPrice!.toLocaleString("en-US")}; asking price ${m.comps.deltaPct}% relative to estimate (${m.comps.compCount} comps).` : "Insufficient recent sold data for a price estimate."}`).join("\n\n---\n\n");
    return {mode: "recommendation", listingId: target.L_ListingID, resultsCount: matches.length, candidateCount: eligible.length, candidateLimit: 100, matches, text: `${text}\n\nComps: same city, residential sales in the last 6 months, living area ±20%. Price estimates are comparisons with recent sales, not appraisals.`};
  } catch (error) {
    return {error: `Recommendation failed: ${error instanceof Error ? error.message : String(error)}`};
  }
}
