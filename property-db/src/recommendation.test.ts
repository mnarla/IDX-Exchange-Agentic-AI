import { afterEach, expect, it } from "vitest";
import { calculateSimilarityScore, validateWithComps, recommendProperties } from "./recommendation.js";
import { setMockQuery } from "./db.js";
import { setMockEmbeddingFn } from "./vector.js";
import type { ActiveListingRow } from "./types.js";
const row = (id: string, extra = {}) => ({ L_ListingID: id, L_City: "Irvine", price: 900000, beds: 3, sqft: 1800, status: "Active", ...extra }) as ActiveListingRow;
afterEach(() => { setMockQuery(null); setMockEmbeddingFn(null); });
it.each([[49999,20],[50000,12],[149999,12],[150000,5],[299999,5],[300000,0]])("scores price boundary %s", (difference, points) => {
  expect(calculateSimilarityScore(row("t"), row("c", { price: 900000 + difference }), [1,0], [1,0]).price).toBe(points);
});
it("scores a perfect match and handles missing values and incompatible vectors", () => {
  expect(calculateSimilarityScore(row("t"),row("c"),[1,0],[1,0]).total).toBe(100);
  expect(calculateSimilarityScore(row("t",{price:null,beds:null,sqft:null,L_City:null}),row("c",{price:null,beds:null,sqft:null,L_City:null}),[],[]).total).toBe(0);
  expect(() => calculateSimilarityScore(row("t"),row("c"),[1],[1,0])).toThrow("embedding");
});
it.each([[299,10],[300,5],[699,5],[700,0]])("scores sqft boundary %s", (difference, points) => {
  expect(calculateSimilarityScore(row("t"), row("c",{sqft:1800+difference}),[],[]).sqft).toBe(points);
});
it("validates comps with safe parameters and correct delta", async () => {
  setMockQuery(async <T>(sql: string, params?: unknown[]) => {
    expect(sql).toContain("INTERVAL 6 MONTH"); expect(sql).toContain("ClosePrice > 0");
    expect(params).toEqual(["Irvine",1440,2160]);
    return [{avg_ppsf:"400",comp_count:8}] as T[];
  });
  expect(await validateWithComps("Irvine",1800,900000)).toMatchObject({status:"available",compPrice:720000,deltaPct:25,compCount:8});
});
it("returns insufficient data for empty comps or missing sqft", async () => {
  setMockQuery(async <T>() => [{avg_ppsf:null,comp_count:0}] as T[]);
  expect(await validateWithComps("Irvine",1800,900000)).toMatchObject({status:"insufficient_data",compPrice:null,deltaPct:null});
  expect(await validateWithComps("Irvine",null,900000)).toMatchObject({status:"insufficient_data"});
});
it("ranks active candidates, excludes the target, and validates only winners", async () => {
  setMockEmbeddingFn(async () => [1,0]);
  setMockQuery(async <T>(sql: string) => {
    if(sql.includes("avg_ppsf")) return [{avg_ppsf:400,comp_count:4}] as T[];
    if(sql.endsWith("LIMIT 1")) return [row("target")] as T[];
    expect(sql).toContain("L_Status = 'Active'");
    return [row("target"),row("sold",{status:"Sold"}),row("worse",{price:1200000}),row("best")] as T[];
  });
  const result = await recommendProperties({listingId:"target",topK:1});
  expect(result).toMatchObject({resultsCount:1,matches:[{listingId:"best",score:{total:100},comps:{compCount:4}}]});
});
it("returns clear errors for missing targets and invalid limits", async () => {
  setMockQuery(async () => []);
  expect(await recommendProperties({listingId:"missing"})).toHaveProperty("error");
  expect(await recommendProperties({listingId:"x",topK:NaN})).toHaveProperty("error");
});
it("normalizes database numeric strings and city casing", () => {
  expect(calculateSimilarityScore(row("t"),row("c",{price:"900000",beds:"3",sqft:"1800",L_City:" irvine "}),[1],[1]).total).toBe(100);
});
it("reports embedding and database failures explicitly", async () => {
  setMockQuery(async () => { throw new Error("Database unavailable"); });
  expect(await recommendProperties({listingId:"x"})).toEqual({error:"Recommendation failed: Database unavailable"});
  setMockQuery(async <T>(sql: string) => (sql.endsWith("LIMIT 1") ? [row("target")] : [row("candidate")]) as T[]);
  setMockEmbeddingFn(async () => {throw new Error("Embedding unavailable");});
  expect(await recommendProperties({listingId:"target"})).toEqual({error:"Recommendation failed: Embedding unavailable"});
});
it("returns five ranked recommendations by default", async () => {
  let compQueries = 0;
  setMockEmbeddingFn(async () => [1,0]);
  setMockQuery(async <T>(sql: string, params?: unknown[]) => {
    if (sql.includes("avg_ppsf")) {compQueries++; return [{avg_ppsf:400,comp_count:2}] as T[];}
    if (sql.endsWith("LIMIT 1")) return [row("target")] as T[];
    expect(sql).toContain("L_SystemPrice <= ?");
    expect(params?.slice(0,2)).toEqual(["Active",1000000]);
    return Array.from({length:7},(_,i) => row(String(i))) as T[];
  });
  const result = await recommendProperties({listingId:"target",filters:{maxPrice:1000000}});
  expect(result).toMatchObject({resultsCount:5}); expect(compQueries).toBe(5);
});
