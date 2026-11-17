import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  classifyIntent,
  orchestrate,
  propertySearchAgent,
  marketStatsAgent,
  recommendationAgent,
  ragAgent,
  emailDraftAgent,
  formatCombinedResponse,
  setMockQuery,
  setMockEmbeddingFn,
} from "./index.js";
import { getSession, clearSession } from "openclaw-plugin-property-nlp";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import entry from "./index.js";

describe("Week 9: Multi-Agent Orchestrator", () => {
  const testUserId = "user-wk9-test";

  beforeEach(() => {
    clearSession(testUserId);
    setMockQuery(null);
    setMockEmbeddingFn(null);
  });

  afterEach(() => {
    clearSession(testUserId);
    setMockQuery(null);
    setMockEmbeddingFn(null);
    vi.restoreAllMocks();
  });

  describe("1. Intent Classification (classifyIntent)", () => {
    it("classifies pure property search queries", async () => {
      expect(await classifyIntent("Find 3-bed homes in Irvine under $1.5M")).toBe("search");
      expect(await classifyIntent("Looking for a condo with a pool in Glendale")).toBe("search");
      expect(await classifyIntent("Search for single family homes under $1,200,000")).toBe("search");
    });

    it("classifies market analytics queries", async () => {
      expect(await classifyIntent("Is now a good time to buy in San Diego?")).toBe("market");
      expect(await classifyIntent("What are the housing market trends in Pasadena?")).toBe("market");
      expect(await classifyIntent("What is the average price per sq ft in Pasadena?")).toBe("market");
      expect(await classifyIntent("Are home prices rising in Irvine?")).toBe("market");
    });

    it("classifies recommendation queries", async () => {
      expect(await classifyIntent("Recommend homes similar to listing 1151238842")).toBe("recommend");
      expect(await classifyIntent("Show me properties similar to the first one")).toBe("recommend");
      expect(await classifyIntent("Are there more homes like this listing?")).toBe("recommend");
    });

    it("classifies conceptual knowledge and RAG queries", async () => {
      expect(await classifyIntent("What is DOM?")).toBe("knowledge");
      expect(await classifyIntent("Explain escrow and earnest money")).toBe("knowledge");
      expect(await classifyIntent("Define list-to-close ratio")).toBe("knowledge");
      expect(await classifyIntent("What columns are in rets_property?")).toBe("knowledge");
    });

    it("classifies email drafting queries", async () => {
      expect(await classifyIntent("Draft an email to client John with our Pasadena summary")).toBe("email");
      expect(await classifyIntent("Compose an email summarizing recent properties")).toBe("email");
      expect(await classifyIntent("Write an email draft for Sarah")).toBe("email");
    });

    it("classifies mixed queries requiring multiple agents in parallel", async () => {
      // The exact handbook example query:
      const handbookQuery = "Find me affordable homes in Pasadena and tell me whether prices are rising.";
      expect(await classifyIntent(handbookQuery)).toBe("mixed");

      expect(await classifyIntent("Find 3-bed houses in Glendale and what are the price trends?")).toBe("mixed");
      expect(await classifyIntent("Show condos in Irvine under $1M and is it a buyer's or seller's market?")).toBe("mixed");
    });

    it("returns unknown for unhandled domains", async () => {
      expect(await classifyIntent("What is the weather in Paris today?")).toBe("unknown");
      expect(await classifyIntent("Can you write a poem about autumn leaves?")).toBe("unknown");
      expect(await classifyIntent("")).toBe("unknown");
    });
  });

  describe("2. Individual Agent Wrappers", () => {
    it("propertySearchAgent executes search and updates session memory", async () => {
      setMockQuery(async (sql) => {
        if (sql.includes("rets_property")) {
          return [
            {
              L_ListingID: "PAS101",
              L_DisplayId: "PAS101",
              L_Address: "123 Colorado Blvd",
              L_City: "Pasadena",
              L_Zip: "91101",
              price: 850000,
              beds: 3,
              baths: 2,
              sqft: 1800,
              type: "SingleFamilyResidence",
              status: "Active",
              lat: 34.14,
              lng: -118.14,
              YearBuilt: 1995,
              AssociationFee: 0,
              DaysOnMarket: 14,
              PoolPrivateYN: "0",
              ViewYN: "0",
              FireplaceYN: "1",
              PhotoCount: 18,
              LA1_UserFirstName: "Jane",
              LA1_UserLastName: "Doe",
              LO1_OrganizationName: "Pasadena Realty",
            },
          ];
        }
        return [];
      });

      const result = await propertySearchAgent("Find 3-bed homes in Pasadena under $900k", testUserId);

      expect(result.intent).toBe("search");
      expect(result.filters).toMatchObject({
        city: "Pasadena",
        minBeds: 3,
        maxPrice: 900000,
      });
      expect(result.text).toContain("123 Colorado Blvd");

      // Verify session memory was populated with lastResults
      const session = getSession(testUserId);
      expect(session.lastResults).toBeDefined();
      expect(session.lastResults?.[0]?.L_ListingID).toBe("PAS101");
    });

    it("marketStatsAgent returns analytics and climate assessment", async () => {
      setMockQuery(async (sql) => {
        if (sql.includes("GROUP BY DATE_FORMAT")) {
          return [
            { month: "2026-04", sales: 25, avg_price: 1000000, avg_price_per_sqft: 620, avg_dom: 25 },
            { month: "2026-05", sales: 25, avg_price: 1050000, avg_price_per_sqft: 650, avg_dom: 22 },
          ];
        }
        if (sql.includes("COUNT(*)") && sql.includes("california_sold")) {
          return [
            {
              City: "Pasadena",
              sold_count: 50,
              avg_close_price: 1100000,
              avg_price_per_sqft: 650,
              avg_dom: 22,
              list_to_close_pct: 101.5,
            },
          ];
        }
        if (sql.includes("rets_property") && sql.includes("COUNT(*)")) {
          return [{ active_count: 30 }];
        }
        if (sql.includes("ClosePrice") && sql.includes("ORDER BY ClosePrice ASC")) {
          return [{ ClosePrice: 1050000 }];
        }
        return [];
      });

      const result = await marketStatsAgent("What are the market trends in Pasadena?");

      expect(result.intent).toBe("market");
      expect(result.city).toBe("Pasadena");
      expect(result.text).toContain("Pasadena");
      expect(result.text).toContain("Median Close Price");
    });

    it("recommendationAgent surfaces similar listings from session lastResults", async () => {
      // Pre-populate session with a liked listing
      const session = getSession(testUserId);
      session.lastResults = [
        {
          L_ListingID: "1151238842",
          L_City: "Glenhaven",
          L_Address: "456 Lake View Rd",
          price: 550000,
          beds: 3,
          baths: 2,
          sqft: 1600,
        },
      ];

      setMockQuery(async (sql) => {
        if (sql.includes("rets_property WHERE L_ListingID = ?")) {
          return [
            {
              L_ListingID: "1151238842",
              L_City: "Glenhaven",
              price: 550000,
              beds: 3,
              baths: 2,
              sqft: 1600,
              status: "Active",
            },
          ];
        }
        if (sql.includes("L_ListingID <> ?")) {
          return [
            {
              L_ListingID: "1151238843",
              L_City: "Glenhaven",
              price: 560000,
              beds: 3,
              baths: 2,
              sqft: 1650,
              status: "Active",
            },
          ];
        }
        if (sql.includes("california_sold")) {
          return [{ avg_ppsf: 350, comp_count: 5 }];
        }
        return [];
      });

      setMockEmbeddingFn(async () => [0.1, 0.2, 0.3]);

      const result = await recommendationAgent(session.lastResults[0]);
      expect(result.intent).toBe("recommend");
      expect(result.listingId).toBe("1151238842");
    });

    it("recommendationAgent falls back gracefully when no listing is found", async () => {
      const result = await recommendationAgent(null, "recommend some houses");
      expect(result.intent).toBe("recommend");
      expect(result.error).toContain("couldn't find a listing in your session");
    });

    it("ragAgent answers conceptual real estate questions", async () => {
      const result = await ragAgent("What does DOM stand for?");
      expect(result.intent).toBe("knowledge");
      expect(result.response).toBeDefined();
    });

    it("emailDraftAgent composes formatted email with recipient and session properties", async () => {
      const session = getSession(testUserId);
      session.city = "Pasadena";
      session.lastResults = [
        {
          L_Address: "123 Colorado Blvd",
          price: 850000,
          beds: 3,
          baths: 2,
          sqft: 1800,
        },
      ];

      const result = await emailDraftAgent("Draft an email to John with our Pasadena listings", testUserId);
      expect(result.intent).toBe("email");
      expect(result.recipient).toBe("John");
      expect(result.subject).toContain("Pasadena");
      expect(result.body).toContain("Dear John,");
      expect(result.body).toContain("123 Colorado Blvd");
      expect(result.body).toContain("$850,000");
    });
  });

  describe("3. Mixed-Intent Parallel Execution (Handbook Spec)", () => {
    it("handles the exact handbook query: 'Find me affordable homes in Pasadena and tell me whether prices are rising.'", async () => {
      setMockQuery(async (sql) => {
        // Active listings search
        if (sql.includes("rets_property") && sql.includes("ORDER BY L_SystemPrice ASC")) {
          return [
            {
              L_ListingID: "PAS_ACT_1",
              L_DisplayId: "PAS_ACT_1",
              L_Address: "789 Green St",
              L_City: "Pasadena",
              L_Zip: "91101",
              price: 799000,
              beds: 2,
              baths: 2,
              sqft: 1200,
              type: "Condominium",
              status: "Active",
              lat: 34.14,
              lng: -118.14,
              YearBuilt: 2005,
              AssociationFee: 350,
              DaysOnMarket: 10,
              PoolPrivateYN: "1",
              ViewYN: "0",
              FireplaceYN: "0",
              PhotoCount: 15,
              LA1_UserFirstName: "Robert",
              LA1_UserLastName: "Smith",
              LO1_OrganizationName: "Green Realty",
            },
          ];
        }

        // Market statistics aggregates
        if (sql.includes("GROUP BY DATE_FORMAT")) {
          return [
            { month: "2026-04", sales: 20, avg_price: 900000, avg_price_per_sqft: 640, avg_dom: 22 },
            { month: "2026-05", sales: 22, avg_price: 950000, avg_price_per_sqft: 680, avg_dom: 19 },
          ];
        }
        if (sql.includes("COUNT(*)") && sql.includes("california_sold")) {
          return [
            {
              City: "Pasadena",
              sold_count: 42,
              avg_close_price: 950000,
              avg_price_per_sqft: 680,
              avg_dom: 19,
              list_to_close_pct: 102.1,
            },
          ];
        }
        if (sql.includes("rets_property") && sql.includes("COUNT(*)")) {
          return [{ active_count: 28 }];
        }
        if (sql.includes("ClosePrice") && sql.includes("ORDER BY ClosePrice ASC")) {
          return [{ ClosePrice: 940000 }];
        }
        return [];
      });

      const handbookQuery = "Find me affordable homes in Pasadena and tell me whether prices are rising.";
      const res = await orchestrate(handbookQuery, testUserId);

      // Verify mixed intent was detected
      expect(res.intent).toBe("mixed");

      // Verify both components are present in the unified response
      expect(res.text).toContain("Market Trends & Climate Analysis");
      expect(res.text).toContain("Matching Active Properties");
      expect(res.text).toContain("789 Green St");
      expect(res.text).toContain("Pasadena");

      // Verify session memory was updated from the search portion
      const session = getSession(testUserId);
      expect(session.city).toBe("Pasadena");
      expect(session.lastResults?.[0]?.L_ListingID).toBe("PAS_ACT_1");
    });

    it("formatCombinedResponse gracefully formats even with missing sub-results", () => {
      const combined = formatCombinedResponse(
        { text: "Found 1 home at 100 Main St" },
        { text: "Pasadena market is competitive" }
      );

      expect(combined.intent).toBe("mixed");
      expect(combined.text).toContain("Pasadena market is competitive");
      expect(combined.text).toContain("Found 1 home at 100 Main St");
    });
  });

  describe("4. End-to-End Multi-Turn Session Flow", () => {
    it("coordinates across search -> recommendation -> email across turns for the same user", async () => {
      setMockQuery(async (sql) => {
        if (sql.includes("rets_property") && sql.includes("ORDER BY L_SystemPrice ASC")) {
          return [
            {
              L_ListingID: "IRV_200",
              L_DisplayId: "IRV_200",
              L_Address: "500 Alton Pkwy",
              L_City: "Irvine",
              L_Zip: "92606",
              price: 1100000,
              beds: 3,
              baths: 2.5,
              sqft: 2000,
              type: "SingleFamilyResidence",
              status: "Active",
              lat: 33.68,
              lng: -117.82,
              YearBuilt: 2012,
              AssociationFee: 150,
              DaysOnMarket: 8,
              PoolPrivateYN: "0",
              ViewYN: "1",
              FireplaceYN: "1",
              PhotoCount: 24,
              LA1_UserFirstName: "Mark",
              LA1_UserLastName: "Taylor",
              LO1_OrganizationName: "Irvine Homes",
            },
          ];
        }
        if (sql.includes("rets_property WHERE L_ListingID = ?")) {
          return [
            {
              L_ListingID: "IRV_200",
              L_City: "Irvine",
              price: 1100000,
              beds: 3,
              baths: 2.5,
              sqft: 2000,
              status: "Active",
            },
          ];
        }
        if (sql.includes("L_ListingID <> ?")) {
          return [
            {
              L_ListingID: "IRV_201",
              L_City: "Irvine",
              price: 1150000,
              beds: 3,
              baths: 2.5,
              sqft: 2050,
              status: "Active",
            },
          ];
        }
        if (sql.includes("california_sold")) {
          return [{ avg_ppsf: 550, comp_count: 8 }];
        }
        return [];
      });

      setMockEmbeddingFn(async () => [0.1, 0.2, 0.3]);

      // Turn 1: Search
      const turn1 = await orchestrate("Find 3 bed homes in Irvine under $1.2M", testUserId);
      expect(turn1.intent).toBe("search");
      expect(turn1.text).toContain("500 Alton Pkwy");

      // Turn 2: Recommendation (relies on Turn 1 session memory)
      const turn2 = await orchestrate("Recommend homes similar to this listing", testUserId);
      expect(turn2.intent).toBe("recommend");
      expect(turn2.listingId).toBe("IRV_200");

      // Turn 3: Email drafting (relies on Turn 1 & 2 session memory)
      const turn3 = await orchestrate("Draft an email for client Alice with these homes", testUserId);
      expect(turn3.intent).toBe("email");
      expect(turn3.recipient).toBe("Alice");
      expect(turn3.body).toContain("500 Alton Pkwy");
      expect(turn3.body).toContain("$1,100,000");
    });
  });

  describe("5. Fallback & OpenClaw Tool Registration", () => {
    it("returns default handbook response on unhandled domain", async () => {
      const res = await orchestrate("Explain how quantum computing works", testUserId);
      expect(res.intent).toBe("unknown");
      expect(res.response).toBe(
        "I'm not sure how to help with that. Try asking about properties or market trends."
      );
    });

    it("registers orchestrate tool in openclaw plugin metadata", () => {
      const metadata = getToolPluginMetadata(entry);
      const orchestrateTool = metadata?.tools.find((t) => t.name === "orchestrate");
      expect(orchestrateTool).toBeDefined();
      expect(orchestrateTool?.description).toContain("Central coordinator");
    });
  });
});
