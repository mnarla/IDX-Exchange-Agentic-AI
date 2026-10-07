import { describe, expect, it } from "vitest";
import entry, { parsePropertyQuery } from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";

describe("property-nlp plugin", () => {
  it("declares tool metadata correctly", () => {
    const metadata = getToolPluginMetadata(entry);
    expect(metadata?.tools.map((t) => t.name)).toEqual(["parse_property_query"]);
    expect(metadata?.tools[0]?.description).toContain("minBeds, minBaths, and minSqft are minimum thresholds (>=)");
    expect(metadata?.tools[0]?.description).toContain("maxPrice and maxHOA are maximum thresholds (<=)");
  });

  describe("parsePropertyQuery - 15 Query Validation Suite", () => {
    it("1. parses standard handbook query with beds, type, city, price, and pool", async () => {
      const result = await parsePropertyQuery("Show me 3-bedroom condos in Irvine under $1.5M with a pool.");
      expect(result).toEqual({
        city: "Irvine",
        maxPrice: 1500000,
        minBeds: 3,
        minBaths: null,
        minSqft: null,
        type: "Condominium",
        pool: "True",
        hasView: null,
        maxHOA: null,
      });
    });

    it("2. parses townhome with view and k suffix", async () => {
      const result = await parsePropertyQuery("2 bed 2 bath townhome in Pasadena under 850k with view");
      expect(result).toEqual({
        city: "Pasadena",
        maxPrice: 850000,
        minBeds: 2,
        minBaths: 2,
        minSqft: null,
        type: "Townhouse",
        pool: null,
        hasView: "True",
        maxHOA: null,
      });
    });

    it("3. parses single family home with multi-word city, pool, and view", async () => {
      const result = await parsePropertyQuery("4 bedroom single family home in Newport Beach under $3.5M with pool and view");
      expect(result).toEqual({
        city: "Newport Beach",
        maxPrice: 3500000,
        minBeds: 4,
        minBaths: null,
        minSqft: null,
        type: "SingleFamilyResidence",
        pool: "True",
        hasView: "True",
        maxHOA: null,
      });
    });

    it("4. parses fractional baths and comma-formatted price", async () => {
      const result = await parsePropertyQuery("3 bed 2.5 bath house in Anaheim under $1,200,000");
      expect(result).toEqual({
        city: "Anaheim",
        maxPrice: 1200000,
        minBeds: 3,
        minBaths: 2.5,
        minSqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("5. parses square footage with 'at least' and m suffix", async () => {
      const result = await parsePropertyQuery("Homes in Irvine with at least 2500 sq ft under 2m");
      expect(result).toEqual({
        city: "Irvine",
        maxPrice: 2000000,
        minBeds: null,
        minBaths: null,
        minSqft: 2500,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("6. parses HOA fee before price and prevents regex collision", async () => {
      const result = await parsePropertyQuery("Condo in Irvine under $900k with HOA under 400");
      expect(result).toEqual({
        city: "Irvine",
        maxPrice: 900000,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: "Condominium",
        pool: null,
        hasView: null,
        maxHOA: 400,
      });
    });

    it("7. parses unimproved land queries", async () => {
      const result = await parsePropertyQuery("Vacant land in Temecula under $500k");
      expect(result).toEqual({
        city: "Temecula",
        maxPrice: 500000,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: "UnimprovedLand",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("8. parses minimalist city and million price query", async () => {
      const result = await parsePropertyQuery("Homes in San Diego under $1M");
      expect(result).toEqual({
        city: "San Diego",
        maxPrice: 1000000,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("9. parses conversational query with no price specified", async () => {
      const result = await parsePropertyQuery("Looking for a 2 bedroom condo in Costa Mesa with a view and pool");
      expect(result).toEqual({
        city: "Costa Mesa",
        maxPrice: null,
        minBeds: 2,
        minBaths: null,
        minSqft: null,
        type: "Condominium",
        pool: "True",
        hasView: "True",
        maxHOA: null,
      });
    });

    it("10. parses N+ beds notation", async () => {
      const result = await parsePropertyQuery("3+ bed townhome in Glendale under $800k");
      expect(result).toEqual({
        city: "Glendale",
        maxPrice: 800000,
        minBeds: 3,
        minBaths: null,
        minSqft: null,
        type: "Townhouse",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("11. parses number words for beds and baths", async () => {
      const result = await parsePropertyQuery("three bedroom two bath house in Fullerton under $1M");
      expect(result).toEqual({
        city: "Fullerton",
        maxPrice: 1000000,
        minBeds: 3,
        minBaths: 2,
        minSqft: null,
        type: "SingleFamilyResidence",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    // 4 Negative / Edge Cases:
    it("12. negative case: returns all nulls for empty string", async () => {
      const result = await parsePropertyQuery("");
      expect(result).toEqual({
        city: null,
        maxPrice: null,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: null,
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("13. negative case: returns all nulls for non-real-estate query", async () => {
      const result = await parsePropertyQuery("What is the weather in Chicago today?");
      expect(result).toEqual({
        city: null,
        maxPrice: null,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: null,
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("14. edge case: returns null city when query has no city specified", async () => {
      const result = await parsePropertyQuery("3 bed 2 bath condo under $600k");
      expect(result).toEqual({
        city: null,
        maxPrice: 600000,
        minBeds: 3,
        minBaths: 2,
        minSqft: null,
        type: "Condominium",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });

    it("15. edge case: handles query with only a type", async () => {
      const result = await parsePropertyQuery("Show me condos");
      expect(result).toEqual({
        city: null,
        maxPrice: null,
        minBeds: null,
        minBaths: null,
        minSqft: null,
        type: "Condominium",
        pool: null,
        hasView: null,
        maxHOA: null,
      });
    });
  });
});
