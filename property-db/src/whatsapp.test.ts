import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  onWhatsAppMessage,
  formatForWhatsApp,
  sendTypingIndicator,
  setCustomTypingHandler,
  setMockQuery,
  setMockEmbeddingFn,
} from "./index.js";
import { clearSession } from "openclaw-plugin-property-nlp";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import entry from "./index.js";

describe("Week 10: WhatsApp Communication Layer", () => {
  const userId = "whatsapp-user-456";

  beforeEach(() => {
    clearSession(userId);
    setMockQuery(null);
    setMockEmbeddingFn(null);
    setCustomTypingHandler(null);
  });

  afterEach(() => {
    clearSession(userId);
    setMockQuery(null);
    setMockEmbeddingFn(null);
    setCustomTypingHandler(null);
    vi.restoreAllMocks();
  });

  describe("1. Typing Indicator (sendTypingIndicator)", () => {
    it("invokes typing indicator hook with the recipient userId", async () => {
      let typingUser: string | null = null;
      setCustomTypingHandler(async (id) => {
        typingUser = id;
      });

      await sendTypingIndicator(userId);
      expect(typingUser).toBe(userId);
    });

    it("handles typing indicator failures gracefully without throwing", async () => {
      setCustomTypingHandler(async () => {
        throw new Error("Network timeout on presence event");
      });

      await expect(sendTypingIndicator(userId)).resolves.not.toThrow();
    });
  });

  describe("2. WhatsApp Card Formatter (formatForWhatsApp)", () => {
    it("formats listings according to the exact Week 10 handbook template", () => {
      const mockResult: any = {
        intent: "search",
        listings: [
          {
            L_Address: "430 N Holliston 210",
            L_City: "Pasadena",
            price: 450000,
            beds: 2,
            baths: 2,
            sqft: 855,
            DaysOnMarket: 55,
          },
          {
            L_Address: "847 N Raymond Ave 9A",
            L_City: "Pasadena",
            price: 499999,
            beds: 2,
            baths: 3,
            sqft: 997,
            DaysOnMarket: 115,
          },
        ],
      };

      const formatted = formatForWhatsApp(mockResult);

      // Verify exact handbook layout:
      // 🏠 *Address, City*
      // 💰 $Price | 🛏 Xbd/Yba | 📐 Z sqft
      // 📅 N days on market
      expect(formatted).toContain("🏠 *430 N Holliston 210, Pasadena*");
      expect(formatted).toContain("💰 $450,000 | 🛏 2bd/2ba | 📐 855 sqft");
      expect(formatted).toContain("📅 55 days on market");

      expect(formatted).toContain("🏠 *847 N Raymond Ave 9A, Pasadena*");
      expect(formatted).toContain("💰 $499,999 | 🛏 2bd/3ba | 📐 997 sqft");
      expect(formatted).toContain("📅 115 days on market");
    });

    it("slices at maximum 5 listings to keep WhatsApp payload concise", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        L_Address: `${i + 1} Main St`,
        L_City: "Irvine",
        price: 1000000 + i * 50000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        DaysOnMarket: i + 1,
      }));

      const formatted = formatForWhatsApp({ intent: "search", listings: items } as any);
      const cardCount = (formatted.match(/🏠/g) || []).length;
      expect(cardCount).toBe(5);
    });

    it("returns direct response text when no listings array is present", () => {
      const formatted = formatForWhatsApp({
        intent: "market",
        response: "Pasadena prices rose 3.2% MoM in September.",
      } as any);

      expect(formatted).toBe("Pasadena prices rose 3.2% MoM in September.");
    });
  });

  describe("3. onWhatsAppMessage Handler Lifecycle", () => {
    it("triggers typing indicator, orchestrates search, and returns WhatsApp cards", async () => {
      let typingTriggered = false;
      setCustomTypingHandler(async () => {
        typingTriggered = true;
      });

      setMockQuery(async (sql) => {
        if (sql.includes("rets_property")) {
          return [
            {
              L_ListingID: "PAS_WK10",
              L_DisplayId: "PAS_WK10",
              L_Address: "430 N Holliston 210",
              L_City: "Pasadena",
              L_Zip: "91106",
              price: 450000,
              beds: 2,
              baths: 2,
              sqft: 855,
              type: "Condominium",
              status: "Active",
              lat: 34.15,
              lng: -118.13,
              YearBuilt: 1988,
              AssociationFee: 510,
              DaysOnMarket: 55,
              PoolPrivateYN: "0",
              ViewYN: "1",
              FireplaceYN: "0",
              PhotoCount: 12,
              LA1_UserFirstName: "Agent",
              LA1_UserLastName: "One",
              LO1_OrganizationName: "Brokerage",
            },
          ];
        }
        return [];
      });

      const reply = await onWhatsAppMessage("Find 2 bed condos in Pasadena under $500k", userId);

      expect(typingTriggered).toBe(true);
      expect(reply).toContain("🏠 *430 N Holliston 210, Pasadena*");
      expect(reply).toContain("💰 $450,000 | 🛏 2bd/2ba | 📐 855 sqft");
      expect(reply).toContain("📅 55 days on market");
    });

    it("handles errors gracefully with the handbook fallback message", async () => {
      setMockQuery(async () => {
        throw new Error("Database connection lost");
      });

      const reply = await onWhatsAppMessage("Find homes in Pasadena", userId);
      expect(reply).toBe("Sorry, I hit an issue. Please try again.");
    });
  });

  describe("4. Tool Plugin Registration", () => {
    it("registers on_whatsapp_message in plugin metadata", () => {
      const metadata = getToolPluginMetadata(entry);
      const tool = metadata?.tools.find((t) => t.name === "on_whatsapp_message");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("WhatsApp communication layer");
    });
  });
});
