import type {
  ActiveListingRow,
  SoldCompRow,
  FormattedActiveCard,
  FormattedSoldCard,
} from "./types.js";

function formatCurrency(val: number | null): string | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return `$${Math.round(val).toLocaleString("en-US")}`;
}

function formatNumber(val: number | null): string | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Number(val).toLocaleString("en-US");
}

export function formatActiveCard(row: ActiveListingRow): FormattedActiveCard {
  const hasPool = row.PoolPrivateYN === "1";
  const hasView = row.ViewYN === "1";
  const hasFireplace = row.FireplaceYN === "1";

  const firstName = row.LA1_UserFirstName?.trim() || "";
  const lastName = row.LA1_UserLastName?.trim() || "";
  const agentName = `${firstName} ${lastName}`.trim() || null;
  const officeName = row.LO1_OrganizationName?.trim() || null;

  // Build WhatsApp-friendly markdown text (no markdown tables)
  const lines: string[] = [];

  const priceStr = formatCurrency(row.price);
  if (priceStr) {
    lines.push(`*${priceStr}*`);
  }

  const specs: string[] = [];
  if (row.beds !== null && row.beds !== undefined) specs.push(`${row.beds} Beds`);
  if (row.baths !== null && row.baths !== undefined) specs.push(`${row.baths} Baths`);
  if (row.sqft !== null && row.sqft !== undefined) specs.push(`${formatNumber(row.sqft)} SqFt`);
  if (specs.length > 0) {
    lines.push(specs.join(" • "));
  }

  const addrParts: string[] = [];
  if (row.L_Address?.trim()) addrParts.push(row.L_Address.trim());
  if (row.L_City?.trim()) addrParts.push(row.L_City.trim());
  if (row.L_Zip?.trim()) addrParts.push(row.L_Zip.trim());
  if (addrParts.length > 0) {
    lines.push(`📍 ${addrParts.join(", ")}`);
  }

  if (row.type?.trim()) {
    lines.push(`🏡 Type: ${row.type.trim()}`);
  }

  if (row.DaysOnMarket !== null && row.DaysOnMarket !== undefined) {
    lines.push(`⏱️ Days on Market: ${row.DaysOnMarket}`);
  }

  if (row.YearBuilt !== null && row.YearBuilt !== undefined && row.YearBuilt > 0) {
    lines.push(`📅 Year Built: ${row.YearBuilt}`);
  }

  if (row.AssociationFee !== null && row.AssociationFee !== undefined && row.AssociationFee > 0) {
    lines.push(`💰 HOA Fee: $${row.AssociationFee}/mo`);
  }

  const amenities: string[] = [];
  if (hasPool) amenities.push("🏊 Private Pool");
  if (hasView) amenities.push("🌅 Scenic View");
  if (hasFireplace) amenities.push("🔥 Fireplace");
  if (amenities.length > 0) {
    lines.push(`✨ Amenities: ${amenities.join(", ")}`);
  }

  if (row.PhotoCount !== null && row.PhotoCount !== undefined && row.PhotoCount > 0) {
    lines.push(`📷 Photos: ${row.PhotoCount}`);
  }

  if (row.L_ListingID?.trim()) {
    lines.push(`🆔 Listing ID: ${row.L_ListingID.trim()}`);
  }

  const cardText = lines.join("\n");

  return {
    listingId: row.L_ListingID,
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    address: row.L_Address?.trim() || null,
    city: row.L_City?.trim() || null,
    zip: row.L_Zip?.trim() || null,
    propertyType: row.type?.trim() || null,
    yearBuilt: row.YearBuilt,
    associationFee: row.AssociationFee,
    daysOnMarket: row.DaysOnMarket,
    hasPool,
    hasView,
    hasFireplace,
    agentName,
    officeName,
    photoCount: row.PhotoCount ?? null,
    text: cardText,
  };
}

export function formatSoldCard(row: SoldCompRow): FormattedSoldCard {
  const listingKey = String(row.ListingKey);
  const closePrice = row.ClosePrice;
  const listPrice = row.ListPrice;
  const priceDiff = closePrice !== null && listPrice !== null ? closePrice - listPrice : null;

  const lines: string[] = [];

  const closePriceStr = formatCurrency(closePrice);
  const listPriceStr = formatCurrency(listPrice);

  if (closePriceStr && listPriceStr) {
    let diffStr = "";
    if (priceDiff !== null && priceDiff !== 0) {
      const sign = priceDiff > 0 ? "+" : "-";
      diffStr = ` (${sign}${formatCurrency(Math.abs(priceDiff))})`;
    }
    lines.push(`*Closed: ${closePriceStr}* (List: ${listPriceStr}${diffStr})`);
  } else if (closePriceStr) {
    lines.push(`*Closed: ${closePriceStr}*`);
  }

  if (row.CloseDate?.trim()) {
    lines.push(`📅 Closed On: ${row.CloseDate.trim()}`);
  }

  if (row.DaysOnMarket !== null && row.DaysOnMarket !== undefined) {
    lines.push(`⏱️ Days on Market: ${row.DaysOnMarket}`);
  }

  const addrParts: string[] = [];
  if (row.UnparsedAddress?.trim()) addrParts.push(row.UnparsedAddress.trim());
  if (row.City?.trim()) addrParts.push(row.City.trim());
  if (addrParts.length > 0) {
    lines.push(`📍 ${addrParts.join(", ")}`);
  }

  const specs: string[] = [];
  if (row.BedroomsTotal !== null && row.BedroomsTotal !== undefined) specs.push(`${row.BedroomsTotal} Beds`);
  if (row.BathroomsTotalInteger !== null && row.BathroomsTotalInteger !== undefined) specs.push(`${row.BathroomsTotalInteger} Baths`);
  if (row.LivingArea !== null && row.LivingArea !== undefined) specs.push(`${formatNumber(row.LivingArea)} SqFt`);
  if (specs.length > 0) {
    lines.push(specs.join(" • "));
  }

  const cardText = lines.join("\n");

  return {
    listingKey,
    address: row.UnparsedAddress?.trim() || null,
    city: row.City?.trim() || null,
    closeDate: row.CloseDate?.trim() || null,
    closePrice,
    listPrice,
    priceDifference: priceDiff,
    daysOnMarket: row.DaysOnMarket,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotalInteger,
    sqft: row.LivingArea,
    propertyType: row.PropertyType?.trim() || null,
    text: cardText,
  };
}

export function formatMarketSummaryCard(
  stats: Omit<import("./types.js").MarketStatistics, "text" | "mode">
): string {
  const lines: string[] = [];

  const loc = stats.zip ? `${stats.city} (${stats.zip})` : stats.city;
  lines.push(`📊 *${loc} Market Statistics (Past ${stats.months} Months)*\n`);

  if (stats.soldCount === 0) {
    lines.push(`No residential sold records found in ${stats.city} for the past ${stats.months} months.`);
    if (stats.activeCount !== null) {
      lines.push(`\n• *Active Listings in MLS:* ${stats.activeCount}`);
    }
    return lines.join("\n");
  }

  // Core metrics
  if (stats.medianClosePrice !== null) {
    lines.push(`• *Median Close Price:* ${formatCurrency(stats.medianClosePrice)}`);
  }
  if (stats.avgClosePrice !== null) {
    lines.push(`• *Average Close Price:* ${formatCurrency(stats.avgClosePrice)}`);
  }
  if (stats.avgPricePerSqft !== null) {
    lines.push(`• *Avg Price / Sq Ft:* $${formatNumber(stats.avgPricePerSqft)}/sq ft`);
  }
  if (stats.avgDom !== null) {
    lines.push(`• *Avg Days on Market:* ${stats.avgDom} days`);
  }
  if (stats.listToClosePct !== null) {
    let leverageNote = "";
    if (stats.listToClosePct >= 101) leverageNote = " (Strong seller leverage / bidding over ask)";
    else if (stats.listToClosePct >= 99) leverageNote = " (Competitive / near asking price)";
    else if (stats.listToClosePct >= 97) leverageNote = " (Moderate buyer negotiation room)";
    else leverageNote = " (Significant buyer negotiation leverage)";
    lines.push(`• *List-to-Close Ratio:* ${stats.listToClosePct}%${leverageNote}`);
  }
  lines.push(`• *Total Sold Volume:* ${stats.soldCount} homes`);
  if (stats.activeCount !== null) {
    lines.push(`• *Active Inventory:* ${stats.activeCount} active listings`);
  }
  if (stats.monthsOfInventory !== null) {
    let moiNote = "";
    if (stats.monthsOfInventory < 3) moiNote = " (Tight supply • Seller's market)";
    else if (stats.monthsOfInventory <= 6) moiNote = " (Balanced supply)";
    else moiNote = " (High inventory • Buyer's market)";
    lines.push(`• *Months of Inventory:* ${stats.monthsOfInventory} mos${moiNote}`);
  }

  // Monthly trends
  if (stats.trends && stats.trends.length > 0) {
    lines.push(`\n📈 *Monthly Price Trends (Recent):*`);
    const recentTrends = stats.trends.slice(-6);
    for (const t of recentTrends) {
      const parts: string[] = [];
      if (t.avgPrice !== null) parts.push(formatCurrency(t.avgPrice) || "");
      parts.push(`${t.sales} sales`);
      if (t.avgDom !== null) parts.push(`${t.avgDom} DOM`);

      let changeStr = "";
      if (t.priceChangePct !== null) {
        const sign = t.priceChangePct >= 0 ? "+" : "";
        changeStr = ` [${sign}${t.priceChangePct}% MoM]`;
      }
      lines.push(`• ${t.month}: ${parts.join(" • ")}${changeStr}`);
    }

    const latest = stats.trends[stats.trends.length - 1];
    if (latest && latest.yoyPriceChangePct !== null) {
      const sign = latest.yoyPriceChangePct >= 0 ? "+" : "";
      lines.push(`• *12-Month YoY Price Change:* ${sign}${latest.yoyPriceChangePct}%`);
    }
  }

  // Market Assessment / Buyer Advice
  lines.push(`\n💡 *Market Assessment:*`);
  const adviceParts: string[] = [];
  if (stats.marketType === "Seller's Market") {
    adviceParts.push(
      `The market in ${stats.city} currently favors sellers due to ${stats.monthsOfInventory !== null ? `${stats.monthsOfInventory} months of inventory` : "tight inventory"} and homes moving quickly (${stats.avgDom ?? "low"} avg DOM).`
    );
    if (stats.listToClosePct && stats.listToClosePct >= 100) {
      adviceParts.push(
        `Homes are selling at or above list price (${stats.listToClosePct}%), so buyers should be prepared with strong pre-approvals and fast decisions.`
      );
    } else {
      adviceParts.push(`Buyers should act decisively on well-priced listings.`);
    }
  } else if (stats.marketType === "Buyer's Market") {
    adviceParts.push(
      `The market in ${stats.city} leans in favor of buyers with ${stats.monthsOfInventory !== null ? `${stats.monthsOfInventory} months of inventory` : "elevated inventory"} and listings averaging ${stats.avgDom ?? 60}+ days on market.`
    );
    if (stats.listToClosePct) {
      adviceParts.push(
        `With a list-to-close ratio of ${stats.listToClosePct}%, buyers have good leverage to negotiate price reductions and seller concessions.`
      );
    }
  } else {
    adviceParts.push(
      `The market in ${stats.city} is currently balanced. Inventory stands at ${stats.monthsOfInventory ?? "approx. 4-5"} months with average DOM at ${stats.avgDom ?? 35} days.`
    );
    adviceParts.push(`Buyers face fair competition and can negotiate reasonably without facing extreme bidding wars.`);
  }

  lines.push(adviceParts.join(" "));

  return lines.join("\n");
}

