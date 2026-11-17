import { orchestrate, type OrchestratorResult } from "./orchestrator.js";

export interface WhatsAppListingItem {
  L_Address?: string | null;
  L_City?: string | null;
  address?: string | null;
  city?: string | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  DaysOnMarket?: number | null;
  daysOnMarket?: number | null;
  [key: string]: unknown;
}

/**
 * Sends a typing indicator presence to the given WhatsApp user ID.
 * Defaults to logging or invoking a custom presence function if provided.
 */
let customTypingHandler: ((userId: string) => Promise<void>) | null = null;

export function setCustomTypingHandler(fn: ((userId: string) => Promise<void>) | null): void {
  customTypingHandler = fn;
}

export async function sendTypingIndicator(userId: string): Promise<void> {
  if (customTypingHandler) {
    try {
      await customTypingHandler(userId);
      return;
    } catch {
      // Graceful fallback if channel presence is unreachable
    }
  }
}

/**
 * Formats an OrchestratorResult specifically for WhatsApp according to the Week 10 handbook specification:
 * 
 * 🏠 *Address, City*
 * 💰 $Price | 🛏 Xbd/Yba | 📐 Z sqft
 * 📅 N days on market
 */
export function formatForWhatsApp(result: OrchestratorResult): string {
  // If result contains listings (from property search or recommendation)
  const listings = (result.listings as WhatsAppListingItem[] | undefined) ||
    ((result.cards as WhatsAppListingItem[] | undefined)) ||
    (Array.isArray(result.matches) ? result.matches.map((m: any) => m.card) : undefined);

  if (Array.isArray(listings) && listings.length > 0) {
    const formattedCards = listings.slice(0, 5).map((l) => {
      const address = l.L_Address || l.address || "Address not provided";
      const city = l.L_City || l.city || "CA";
      const priceStr = l.price !== null && l.price !== undefined ? `$${Number(l.price).toLocaleString("en-US")}` : "Contact for Price";
      const beds = l.beds ?? "—";
      const baths = l.baths ?? "—";
      const sqft = l.sqft !== null && l.sqft !== undefined ? `${Number(l.sqft).toLocaleString("en-US")} sqft` : "— sqft";
      const dom = l.DaysOnMarket ?? l.daysOnMarket ?? "—";

      return (
        `🏠 *${address}, ${city}*\n` +
        `💰 ${priceStr} | 🛏 ${beds}bd/${baths}ba | 📐 ${sqft}\n` +
        `📅 ${dom} days on market`
      );
    }).join("\n\n");

    // If this is a mixed query, prepend the market summary
    if (result.intent === "mixed" && result.stats) {
      const statsObj = result.stats as Record<string, unknown>;
      const statsText = (statsObj.text as string) || (statsObj.response as string) || "";
      if (statsText) {
        return `${statsText}\n\n==============================\n\n${formattedCards}`;
      }
    }

    return formattedCards;
  }

  return result.response || result.text || "No results found.";
}

/**
 * Week 10 Message Handler:
 * Primary WhatsApp entry point that shows a typing indicator while processing,
 * invokes orchestrate(), and returns clean WhatsApp markdown.
 */
export async function onWhatsAppMessage(message: string, userId: string): Promise<string> {
  // Typing indicator while processing
  await sendTypingIndicator(userId);

  try {
    const result = await orchestrate(message, userId);
    return formatForWhatsApp(result);
  } catch (err) {
    console.error("Orchestration error:", err);
    return "Sorry, I hit an issue. Please try again.";
  }
}
