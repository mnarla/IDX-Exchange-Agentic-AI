import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import entry, {
  queryPropertyMls,
  searchActiveListings,
  getSoldComps,
  adaptFiltersToSQL,
  formatActiveCard,
  formatSoldCard,
  formatMarketSummaryCard,
  getMarketStatistics,
  calculateMedian,
  calculateMonthlyTrends,
  calculateMarketClimate,
  setMockQuery,
  getRequiredEnv,
} from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import { parsePropertyQuery } from "openclaw-plugin-property-nlp";
import type { ActiveListingRow, SoldCompRow, MonthlyTrendRawRow } from "./types.js";

describe("property-db plugin", () => {
  beforeEach(() => {
    setMockQuery(null);
  });

  afterEach(() => {
    setMockQuery(null);
    vi.restoreAllMocks();
  });

  describe("tool metadata", () => {
    it("registers query_property_mls and get_market_statistics tools correctly", () => {
      const metadata = getToolPluginMetadata(entry);
      expect(metadata?.tools.map((t) => t.name)).toEqual([
        "query_property_mls",
        "get_market_statistics",
      ]);
      expect(metadata?.tools[0]?.description).toContain("Query active MLS listings");
      expect(metadata?.tools[1]?.description).toContain("market analytics");
    });
  });


  describe("environment variable safety", () => {
    it("throws a clear error when required MYSQL environment variables are missing", () => {
      const originalEnv = { ...process.env };
      delete process.env.MYSQL_HOST;

      expect(() => getRequiredEnv("MYSQL_HOST")).toThrow(
        "Missing required database environment variable: MYSQL_HOST"
      );

      process.env = originalEnv;
    });
  });

  describe("SQL parameterization & injection defense", () => {
    it("ensures malicious input appears ONLY in query params, never in SQL text", async () => {
      let executedSql = "";
      let executedParams: any[] = [];

      setMockQuery(async (sql, params = []) => {
        executedSql = sql;
        executedParams = params;
        return [];
      });

      const maliciousCity = "Santa Cruz'; DROP TABLE rets_property;--";
      await searchActiveListings({ city: maliciousCity });

      expect(executedSql).not.toContain("DROP TABLE");
      expect(executedSql).not.toContain("Santa Cruz");
      expect(executedParams).toContain(maliciousCity);
      expect(executedSql).toContain("AND L_City = ?");
    });

    it("verifies adaptFiltersToSQL maps all Week 2 keys to ? placeholders", () => {
      const { whereClause, params } = adaptFiltersToSQL({
        city: "Irvine",
        maxPrice: 1500000,
        minBeds: 3,
        minBaths: 2.5,
        minSqft: 2000,
        type: "SingleFamilyResidence",
        pool: "True",
        hasView: "True",
        maxHOA: 400,
      });

      expect(whereClause).toBe(
        "WHERE L_Status = ? AND L_City = ? AND L_SystemPrice <= ? AND L_Keyword2 >= ? AND LM_Dec_3 >= ? AND LM_Int2_3 >= ? AND L_Type_ = ? AND PoolPrivateYN = ? AND ViewYN = ? AND AssociationFee <= ?"
      );
      expect(params).toEqual([
        "Active",
        "Irvine",
        1500000,
        3,
        2.5,
        2000,
        "SingleFamilyResidence",
        "1",
        "1",
        400,
      ]);
    });

    it("handles empty filters with only base active clause", () => {
      const { whereClause, params } = adaptFiltersToSQL({});
      expect(whereClause).toBe("WHERE L_Status = ?");
      expect(params).toEqual(["Active"]);
    });
  });

  describe("end-to-end integration: Week 2 parser -> adapter -> SQL params", () => {
    it("parses natural language query and creates matching SQL parameters", async () => {
      const parsed = await parsePropertyQuery(
        "Show me 3-bedroom condos in Irvine under $1.5M with a pool"
      );
      const { whereClause, params } = adaptFiltersToSQL(parsed);

      expect(whereClause).toContain("AND L_City = ?");
      expect(whereClause).toContain("AND L_SystemPrice <= ?");
      expect(whereClause).toContain("AND L_Keyword2 >= ?");
      expect(whereClause).toContain("AND L_Type_ = ?");
      expect(whereClause).toContain("AND PoolPrivateYN = ?");

      expect(params).toEqual([
        "Active",
        "Irvine",
        1500000,
        3,
        "Condominium",
        "1",
      ]);
    });
  });

  describe("searchActiveListings pagination & sorting", () => {
    it("orders by L_SystemPrice ASC, L_ListingID ASC and calculates page offset", async () => {
      let executedSql = "";
      let executedParams: any[] = [];

      setMockQuery(async (sql, params = []) => {
        executedSql = sql;
        executedParams = params;
        return [];
      });

      await searchActiveListings({ city: "Pasadena" }, 2, 10);

      expect(executedSql).toContain("ORDER BY L_SystemPrice ASC, L_ListingID ASC");
      expect(executedSql).toContain("LIMIT ? OFFSET ?");
      // fetchLimit = 11, offset = 10 for page 2 limit 10
      expect(executedParams.slice(-2)).toEqual([11, 10]);
    });

    it("clamps limit between 1 and 50, and clamps page to >= 1", async () => {
      let executedParams: any[] = [];

      setMockQuery(async (sql, params = []) => {
        executedParams = params;
        return [];
      });

      // Page -5, limit 100
      await searchActiveListings({}, -5, 100);
      expect(executedParams.slice(-2)).toEqual([51, 0]); // limit 50 + 1 = 51, offset 0 (page 1)

      // Page 3, limit 0
      await searchActiveListings({}, 3, 0);
      expect(executedParams.slice(-2)).toEqual([2, 2]); // limit 1 + 1 = 2, offset (3-1)*1 = 2
    });

    it("calculates hasMore correctly based on limit + 1 rows returned", async () => {
      const fakeRow: ActiveListingRow = {
        L_ListingID: "1001",
        L_DisplayId: "CR1001",
        L_Address: "123 Main St",
        L_City: "Irvine",
        L_Zip: "92618",
        price: 900000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        type: "Condominium",
        status: "Active",
        lat: 33.68,
        lng: -117.82,
        YearBuilt: 2010,
        AssociationFee: 300,
        DaysOnMarket: 14,
        PoolPrivateYN: "1",
        ViewYN: "1",
        FireplaceYN: "0",
        PhotoCount: 15,
        LA1_UserFirstName: "Jane",
        LA1_UserLastName: "Doe",
        LO1_OrganizationName: "Realty One",
      };

      // Mock returning 11 rows for limit 10
      setMockQuery(async () => Array(11).fill(fakeRow));
      const resWithMore = await searchActiveListings({}, 1, 10);
      expect(resWithMore.hasMore).toBe(true);
      expect(resWithMore.cards.length).toBe(10);

      // Mock returning 5 rows for limit 10
      setMockQuery(async () => Array(5).fill(fakeRow));
      const resWithoutMore = await searchActiveListings({}, 1, 10);
      expect(resWithoutMore.hasMore).toBe(false);
      expect(resWithoutMore.cards.length).toBe(5);
    });
  });

  describe("getSoldComps", () => {
    it("throws or rejects when city is missing", async () => {
      await expect(getSoldComps("")).rejects.toThrow("City is required to query sold comps.");
    });

    it("executes sold comps query with city, months, and residential filter", async () => {
      let executedSql = "";
      let executedParams: any[] = [];

      setMockQuery(async (sql, params = []) => {
        executedSql = sql;
        executedParams = params;
        return [];
      });

      await getSoldComps("Irvine", 6);

      expect(executedSql).toContain("FROM california_sold");
      expect(executedSql).toContain("WHERE City = ?");
      expect(executedSql).toContain("AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)");
      expect(executedSql).toContain('AND PropertyType = "Residential"');
      expect(executedSql).toContain("ORDER BY CloseDate DESC");
      expect(executedSql).toContain("LIMIT 50");
      expect(executedParams).toEqual(["Irvine", 6]);
    });
  });

  describe("card formatter", () => {
    it("formats complete active card with WhatsApp markdown and structured fields", () => {
      const row: ActiveListingRow = {
        L_ListingID: "1177293155",
        L_DisplayId: "CR1177293155",
        L_Address: "44 Fallbrook",
        L_City: "Irvine",
        L_Zip: "92620",
        price: 735000,
        beds: 3,
        baths: 2,
        sqft: 1084,
        type: "Condominium",
        status: "Active",
        lat: 33.69,
        lng: -117.75,
        YearBuilt: 1980,
        AssociationFee: 350,
        DaysOnMarket: 8,
        PoolPrivateYN: "1",
        ViewYN: "1",
        FireplaceYN: "1",
        PhotoCount: 20,
        LA1_UserFirstName: "John",
        LA1_UserLastName: "Smith",
        LO1_OrganizationName: "Pacific Realty",
      };

      const card = formatActiveCard(row);

      expect(card.price).toBe(735000);
      expect(card.listingId).toBe("1177293155");
      expect(card.photoCount).toBe(20);
      expect(card.hasPool).toBe(true);
      expect(card.hasView).toBe(true);
      expect(card.hasFireplace).toBe(true);
      expect(card.text).toContain("*$735,000*");
      expect(card.text).toContain("3 Beds • 2 Baths • 1,084 SqFt");
      expect(card.text).toContain("📍 44 Fallbrook, Irvine, 92620");
      expect(card.text).toContain("💰 HOA Fee: $350/mo");
      expect(card.text).toContain("✨ Amenities: 🏊 Private Pool, 🌅 Scenic View, 🔥 Fireplace");
      expect(card.text).toContain("📷 Photos: 20");
    });

    it("handles null fields gracefully without rendering 'null' or 'undefined'", () => {
      const row: ActiveListingRow = {
        L_ListingID: "999",
        L_DisplayId: null,
        L_Address: "10 Minimal Way",
        L_City: "Irvine",
        L_Zip: null,
        price: 500000,
        beds: null,
        baths: null,
        sqft: null,
        type: null,
        status: "Active",
        lat: null,
        lng: null,
        YearBuilt: null,
        AssociationFee: null,
        DaysOnMarket: null,
        PoolPrivateYN: null,
        ViewYN: null,
        FireplaceYN: null,
        PhotoCount: null,
        LA1_UserFirstName: null,
        LA1_UserLastName: null,
        LO1_OrganizationName: null,
      };

      const card = formatActiveCard(row);

      expect(card.text).not.toContain("null");
      expect(card.text).not.toContain("undefined");
      expect(card.text).toContain("*$500,000*");
      expect(card.text).toContain("📍 10 Minimal Way, Irvine");
      expect(card.text).not.toContain("HOA");
      expect(card.text).not.toContain("Amenities");
    });

    it("formats sold comp card with list vs close price differential", () => {
      const row: SoldCompRow = {
        ListingKey: 1190788846,
        UnparsedAddress: "15335 Seine Circle",
        City: "Irvine",
        CloseDate: "2026-09-17",
        ClosePrice: 2100000,
        OriginalListPrice: 2199900,
        ListPrice: 2199900,
        DaysOnMarket: 12,
        BedroomsTotal: 6,
        BathroomsTotalInteger: 4,
        LivingArea: 3100,
        PropertyType: "Residential",
        PropertySubType: "Single Family",
        YearBuilt: 1995,
        ListAgentFullName: "Alice Brown",
        ListOfficeName: "Compass",
        BuyerOfficeName: "Coldwell Banker",
      };

      const card = formatSoldCard(row);

      expect(card.listingKey).toBe("1190788846");
      expect(card.priceDifference).toBe(-99900);
      expect(card.text).toContain("*Closed: $2,100,000* (List: $2,199,900 (-$99,900))");
      expect(card.text).toContain("📅 Closed On: 2026-09-17");
      expect(card.text).toContain("📍 15335 Seine Circle, Irvine");
      expect(card.text).toContain("6 Beds • 4 Baths • 3,100 SqFt");
      expect(card.text).not.toContain("null");
    });
  });

  describe("queryPropertyMls tool execution", () => {
    it("returns clear error if city is missing in sold mode", async () => {
      const result = await queryPropertyMls({ mode: "sold" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("City is required");
      }
    });

    it("returns clear error if city is missing in both mode", async () => {
      const result = await queryPropertyMls({ mode: "both" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("City is required");
      }
    });

    it("executes both mode and combines active and sold results", async () => {
      const fakeActive: ActiveListingRow = {
        L_ListingID: "1",
        L_DisplayId: "1",
        L_Address: "1 Test St",
        L_City: "Irvine",
        L_Zip: "92618",
        price: 800000,
        beds: 3,
        baths: 2,
        sqft: 1200,
        type: "Condominium",
        status: "Active",
        lat: 33.6,
        lng: -117.8,
        YearBuilt: 2005,
        AssociationFee: 200,
        DaysOnMarket: 5,
        PoolPrivateYN: "0",
        ViewYN: "0",
        FireplaceYN: "0",
        PhotoCount: 1,
        LA1_UserFirstName: "Agent",
        LA1_UserLastName: "One",
        LO1_OrganizationName: "Broker",
      };

      const fakeSold: SoldCompRow = {
        ListingKey: 2,
        UnparsedAddress: "2 Test St",
        City: "Irvine",
        CloseDate: "2026-09-01",
        ClosePrice: 850000,
        OriginalListPrice: 850000,
        ListPrice: 850000,
        DaysOnMarket: 10,
        BedroomsTotal: 3,
        BathroomsTotalInteger: 2,
        LivingArea: 1200,
        PropertyType: "Residential",
        PropertySubType: "Single Family",
        YearBuilt: 2005,
        ListAgentFullName: "Agent Two",
        ListOfficeName: "Broker",
        BuyerOfficeName: "Broker",
      };

      setMockQuery(async (sql) => {
        if (sql.includes("rets_property")) return [fakeActive];
        if (sql.includes("california_sold")) return [fakeSold];
        return [];
      });

      const res = await queryPropertyMls({
        mode: "both",
        city: "Irvine",
      });

      expect(res.mode).toBe("both");
      if (res.mode === "both") {
        expect(res.active.cards.length).toBe(1);
        expect(res.sold.cards.length).toBe(1);
        expect(res.text).toContain("Found 1 active listing");
        expect(res.text).toContain("Found 1 recent sold comp");
      }
    });

    it("executes stats mode via queryPropertyMls", async () => {
      setMockQuery(async (sql) => {
        if (sql.includes("COUNT(*)                                              AS sold_count")) {
          return [
            {
              City: "Pasadena",
              sold_count: 50,
              avg_close_price: 1200000,
              avg_price_per_sqft: 750,
              avg_dom: 25,
              list_to_close_pct: 101.5,
            },
          ];
        }
        if (sql.includes("SELECT ClosePrice")) {
          return [{ ClosePrice: 1100000 }, { ClosePrice: 1200000 }, { ClosePrice: 1300000 }];
        }
        if (sql.includes("COUNT(*) AS active_count")) {
          return [{ active_count: 10 }];
        }
        if (sql.includes("GROUP BY DATE_FORMAT(CloseDate")) {
          return [
            {
              month: "2026-09",
              sales: 25,
              avg_price: 1180000,
              avg_price_per_sqft: 740,
              avg_dom: 24,
              list_to_close_pct: 101.2,
            },
            {
              month: "2026-10",
              sales: 25,
              avg_price: 1220000,
              avg_price_per_sqft: 760,
              avg_dom: 26,
              list_to_close_pct: 101.8,
            },
          ];
        }
        return [];
      });

      const res = await queryPropertyMls({
        mode: "stats",
        city: "Pasadena",
      });

      expect("mode" in res && res.mode === "stats").toBe(true);
      if ("mode" in res && res.mode === "stats") {
        expect(res.city).toBe("Pasadena");
        expect(res.soldCount).toBe(50);
        expect(res.medianClosePrice).toBe(1200000);
        expect(res.avgClosePrice).toBe(1200000);
        expect(res.avgPricePerSqft).toBe(750);
        expect(res.listToClosePct).toBe(101.5);
        expect(res.marketType).toBe("Seller's Market");
        expect(res.text).toContain("Pasadena Market Statistics");
        expect(res.text).toContain("Seller's market");
      }
    });
  });

  describe("Week 5: Market Statistics Engine", () => {
    describe("calculateMedian", () => {
      it("returns null for empty array", () => {
        expect(calculateMedian([])).toBeNull();
      });

      it("returns exact middle element for odd length array", () => {
        expect(calculateMedian([900000, 1200000, 1500000])).toBe(1200000);
      });

      it("returns rounded average of two middle elements for even length array", () => {
        expect(calculateMedian([800000, 900000, 1100000, 1400000])).toBe(1000000);
      });

      it("handles unsorted numbers correctly", () => {
        expect(calculateMedian([1500000, 800000, 1200000])).toBe(1200000);
      });
    });

    describe("calculateMonthlyTrends", () => {
      it("returns empty array for empty inputs", () => {
        expect(calculateMonthlyTrends([])).toEqual([]);
      });

      it("calculates MoM and YoY price change percentages accurately", () => {
        const rawRows: MonthlyTrendRawRow[] = [
          {
            month: "2025-10",
            sales: 20,
            avg_price: 1000000,
            avg_price_per_sqft: 600,
            avg_dom: 30,
            list_to_close_pct: 99.0,
          },
          {
            month: "2026-09",
            sales: 25,
            avg_price: 1050000,
            avg_price_per_sqft: 630,
            avg_dom: 28,
            list_to_close_pct: 100.0,
          },
          {
            month: "2026-10",
            sales: 30,
            avg_price: 1100000,
            avg_price_per_sqft: 660,
            avg_dom: 25,
            list_to_close_pct: 100.5,
          },
        ];

        const trends = calculateMonthlyTrends(rawRows);
        expect(trends.length).toBe(3);

        // First month has no previous month MoM
        expect(trends[0]?.priceChangePct).toBeNull();
        expect(trends[0]?.yoyPriceChangePct).toBeNull();

        // Second month: (1050000 - 1000000) / 1000000 = +5.0%
        expect(trends[1]?.priceChangePct).toBe(5.0);

        // Third month MoM: (1100000 - 1050000) / 1050000 = +4.8%
        expect(trends[2]?.priceChangePct).toBe(4.8);

        // Third month YoY (2026-10 vs 2025-10): (1100000 - 1000000) / 1000000 = +10.0%
        expect(trends[2]?.yoyPriceChangePct).toBe(10.0);
      });
    });

    describe("calculateMarketClimate", () => {
      it("identifies Seller's Market when inventory is low (< 3 months)", () => {
        expect(calculateMarketClimate(2.1, 99.5, 25)).toBe("Seller's Market");
      });

      it("identifies Buyer's Market when inventory is elevated (> 6 months)", () => {
        expect(calculateMarketClimate(7.5, 96.0, 75)).toBe("Buyer's Market");
      });

      it("identifies Balanced Market when inventory is 3-6 months", () => {
        expect(calculateMarketClimate(4.2, 99.0, 38)).toBe("Balanced Market");
      });

      it("falls back to list-to-close ratio if inventory is null", () => {
        expect(calculateMarketClimate(null, 102.0, 20)).toBe("Seller's Market");
        expect(calculateMarketClimate(null, 96.5, 70)).toBe("Buyer's Market");
        expect(calculateMarketClimate(null, 99.2, 35)).toBe("Balanced Market");
      });
    });

    describe("getMarketStatistics execution & safety", () => {
      it("returns clear error if city is missing or empty", async () => {
        const res = await getMarketStatistics({ city: "   " });
        expect("error" in res).toBe(true);
        if ("error" in res) {
          expect(res.error).toContain("City is required");
        }
      });

      it("parameterizes all inputs safely to prevent SQL injection", async () => {
        const executedQueries: { sql: string; params: any[] }[] = [];

        setMockQuery(async (sql, params = []) => {
          executedQueries.push({ sql, params });
          return [];
        });

        const maliciousCity = "San Diego'; DROP TABLE california_sold;--";
        await getMarketStatistics({
          city: maliciousCity,
          months: 12,
        });

        for (const q of executedQueries) {
          expect(q.sql).not.toContain("DROP TABLE");
          expect(q.sql).not.toContain("San Diego';");
          expect(q.params).toContain(maliciousCity);
        }
      });

      it("computes full market statistics with inventory absorption and trends", async () => {
        setMockQuery(async (sql) => {
          if (sql.includes("COUNT(*)                                              AS sold_count")) {
            return [
              {
                City: "San Diego",
                sold_count: 120,
                avg_close_price: 950000,
                avg_price_per_sqft: 650,
                avg_dom: 29.5,
                list_to_close_pct: 100.2,
              },
            ];
          }
          if (sql.includes("SELECT ClosePrice")) {
            return [
              { ClosePrice: 800000 },
              { ClosePrice: 900000 },
              { ClosePrice: 920000 },
              { ClosePrice: 1050000 },
            ];
          }
          if (sql.includes("COUNT(*) AS active_count")) {
            return [{ active_count: 20 }];
          }
          if (sql.includes("GROUP BY DATE_FORMAT(CloseDate")) {
            return [
              {
                month: "2026-08",
                sales: 40,
                avg_price: 930000,
                avg_price_per_sqft: 640,
                avg_dom: 31,
                list_to_close_pct: 99.8,
              },
              {
                month: "2026-09",
                sales: 40,
                avg_price: 950000,
                avg_price_per_sqft: 650,
                avg_dom: 29,
                list_to_close_pct: 100.2,
              },
            ];
          }
          return [];
        });

        const res = await getMarketStatistics({
          city: "San Diego",
          months: 12,
        });

        expect("mode" in res && res.mode === "stats").toBe(true);
        if ("mode" in res && res.mode === "stats") {
          expect(res.city).toBe("San Diego");
          expect(res.soldCount).toBe(120);
          expect(res.avgClosePrice).toBe(950000);
          // Median of [800k, 900k, 920k, 1050k] = (900k + 920k)/2 = 910k
          expect(res.medianClosePrice).toBe(910000);
          expect(res.avgPricePerSqft).toBe(650);
          expect(res.avgDom).toBe(29.5);
          expect(res.listToClosePct).toBe(100.2);
          expect(res.activeCount).toBe(20);
          // 120 sold in 12 mos = 10 sold/mo. 20 active / 10 = 2.0 mos inventory
          expect(res.monthsOfInventory).toBe(2.0);
          expect(res.marketType).toBe("Seller's Market");
          expect(res.trends.length).toBe(2);
          expect(res.trends[1]?.priceChangePct).toBe(2.2);

          // Card formatting verification
          expect(res.text).toContain("📊 *San Diego Market Statistics (Past 12 Months)*");
          expect(res.text).toContain("• *Median Close Price:* $910,000");
          expect(res.text).toContain("• *Avg Price / Sq Ft:* $650/sq ft");
          expect(res.text).toContain("• *Months of Inventory:* 2 mos (Tight supply • Seller's market)");
          expect(res.text).toContain("💡 *Market Assessment:*");
          expect(res.text).toContain("favors sellers");
        }
      });

      it("handles zero sales gracefully without division by zero errors", async () => {
        setMockQuery(async () => []);

        const res = await getMarketStatistics({
          city: "GhostTown",
          months: 12,
        });

        expect("mode" in res && res.mode === "stats").toBe(true);
        if ("mode" in res && res.mode === "stats") {
          expect(res.soldCount).toBe(0);
          expect(res.medianClosePrice).toBeNull();
          expect(res.avgClosePrice).toBeNull();
          expect(res.monthsOfInventory).toBeNull();
          expect(res.text).toContain("No residential sold records found in GhostTown");
        }
      });
    });
  });
});

