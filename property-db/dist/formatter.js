function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val))
        return null;
    return `$${Math.round(val).toLocaleString("en-US")}`;
}
function formatNumber(val) {
    if (val === null || val === undefined || isNaN(val))
        return null;
    return Number(val).toLocaleString("en-US");
}
export function formatActiveCard(row) {
    const hasPool = row.PoolPrivateYN === "1";
    const hasView = row.ViewYN === "1";
    const hasFireplace = row.FireplaceYN === "1";
    const firstName = row.LA1_UserFirstName?.trim() || "";
    const lastName = row.LA1_UserLastName?.trim() || "";
    const agentName = `${firstName} ${lastName}`.trim() || null;
    const officeName = row.LO1_OrganizationName?.trim() || null;
    // Build WhatsApp-friendly markdown text (no markdown tables)
    const lines = [];
    const priceStr = formatCurrency(row.price);
    if (priceStr) {
        lines.push(`*${priceStr}*`);
    }
    const specs = [];
    if (row.beds !== null && row.beds !== undefined)
        specs.push(`${row.beds} Beds`);
    if (row.baths !== null && row.baths !== undefined)
        specs.push(`${row.baths} Baths`);
    if (row.sqft !== null && row.sqft !== undefined)
        specs.push(`${formatNumber(row.sqft)} SqFt`);
    if (specs.length > 0) {
        lines.push(specs.join(" • "));
    }
    const addrParts = [];
    if (row.L_Address?.trim())
        addrParts.push(row.L_Address.trim());
    if (row.L_City?.trim())
        addrParts.push(row.L_City.trim());
    if (row.L_Zip?.trim())
        addrParts.push(row.L_Zip.trim());
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
    const amenities = [];
    if (hasPool)
        amenities.push("🏊 Private Pool");
    if (hasView)
        amenities.push("🌅 Scenic View");
    if (hasFireplace)
        amenities.push("🔥 Fireplace");
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
export function formatSoldCard(row) {
    const listingKey = String(row.ListingKey);
    const closePrice = row.ClosePrice;
    const listPrice = row.ListPrice;
    const priceDiff = closePrice !== null && listPrice !== null ? closePrice - listPrice : null;
    const lines = [];
    const closePriceStr = formatCurrency(closePrice);
    const listPriceStr = formatCurrency(listPrice);
    if (closePriceStr && listPriceStr) {
        let diffStr = "";
        if (priceDiff !== null && priceDiff !== 0) {
            const sign = priceDiff > 0 ? "+" : "-";
            diffStr = ` (${sign}${formatCurrency(Math.abs(priceDiff))})`;
        }
        lines.push(`*Closed: ${closePriceStr}* (List: ${listPriceStr}${diffStr})`);
    }
    else if (closePriceStr) {
        lines.push(`*Closed: ${closePriceStr}*`);
    }
    if (row.CloseDate?.trim()) {
        lines.push(`📅 Closed On: ${row.CloseDate.trim()}`);
    }
    if (row.DaysOnMarket !== null && row.DaysOnMarket !== undefined) {
        lines.push(`⏱️ Days on Market: ${row.DaysOnMarket}`);
    }
    const addrParts = [];
    if (row.UnparsedAddress?.trim())
        addrParts.push(row.UnparsedAddress.trim());
    if (row.City?.trim())
        addrParts.push(row.City.trim());
    if (addrParts.length > 0) {
        lines.push(`📍 ${addrParts.join(", ")}`);
    }
    const specs = [];
    if (row.BedroomsTotal !== null && row.BedroomsTotal !== undefined)
        specs.push(`${row.BedroomsTotal} Beds`);
    if (row.BathroomsTotalInteger !== null && row.BathroomsTotalInteger !== undefined)
        specs.push(`${row.BathroomsTotalInteger} Baths`);
    if (row.LivingArea !== null && row.LivingArea !== undefined)
        specs.push(`${formatNumber(row.LivingArea)} SqFt`);
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
