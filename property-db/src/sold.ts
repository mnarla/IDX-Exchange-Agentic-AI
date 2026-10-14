import { query } from "./db.js";
import { formatSoldCard } from "./formatter.js";
import type { SoldCompRow, SoldCompsResult } from "./types.js";

export async function getSoldComps(
  city: string,
  months: number = 12
): Promise<SoldCompsResult> {
  const cleanCity = city?.trim();
  if (!cleanCity) {
    throw new Error("City is required to query sold comps.");
  }

  const safeMonths = Math.max(1, Math.min(120, Math.floor(Number(months) || 12)));

  const sql = `
SELECT
  ListingKey, UnparsedAddress, City, CloseDate, ClosePrice,
  OriginalListPrice, ListPrice, DaysOnMarket, BedroomsTotal,
  BathroomsTotalInteger, LivingArea, PropertyType, PropertySubType,
  YearBuilt, ListAgentFullName, ListOfficeName, BuyerOfficeName
FROM california_sold
WHERE City = ?
  AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
  AND PropertyType = "Residential"
ORDER BY CloseDate DESC
LIMIT 50
  `.trim();

  const rows = await query<SoldCompRow>(sql, [cleanCity, safeMonths]);
  const cards = rows.map(formatSoldCard);

  const textHeader = `📊 Found ${cards.length} recent sold comp${cards.length === 1 ? "" : "s"} in ${cleanCity} (Past ${safeMonths} Months):\n\n`;
  const cardsText = cards.map((c, i) => `[Comp ${i + 1}]\n${c.text}`).join("\n\n---\n\n");
  const fullText = cards.length > 0 ? `${textHeader}${cardsText}` : `No sold comps found in ${cleanCity} for the last ${safeMonths} months.`;

  return {
    mode: "sold",
    city: cleanCity,
    months: safeMonths,
    cards,
    text: fullText,
  };
}
