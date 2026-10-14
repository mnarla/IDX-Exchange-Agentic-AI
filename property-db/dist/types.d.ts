import type { PropertyFilter } from "openclaw-plugin-property-nlp";
export type { PropertyFilter };
export interface ActiveListingRow {
    L_ListingID: string;
    L_DisplayId: string | null;
    L_Address: string | null;
    L_City: string | null;
    L_Zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    type: string | null;
    status: string | null;
    lat: number | null;
    lng: number | null;
    YearBuilt: number | null;
    AssociationFee: number | null;
    DaysOnMarket: number | null;
    PoolPrivateYN: string | null;
    ViewYN: string | null;
    FireplaceYN: string | null;
    PhotoCount: number | null;
    LA1_UserFirstName: string | null;
    LA1_UserLastName: string | null;
    LO1_OrganizationName: string | null;
}
export interface SoldCompRow {
    ListingKey: number | string;
    UnparsedAddress: string | null;
    City: string | null;
    CloseDate: string | null;
    ClosePrice: number | null;
    OriginalListPrice: number | null;
    ListPrice: number | null;
    DaysOnMarket: number | null;
    BedroomsTotal: number | null;
    BathroomsTotalInteger: number | null;
    LivingArea: number | null;
    PropertyType: string | null;
    PropertySubType: string | null;
    YearBuilt: number | null;
    ListAgentFullName: string | null;
    ListOfficeName: string | null;
    BuyerOfficeName: string | null;
}
export interface FormattedActiveCard {
    listingId: string;
    price: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    address: string | null;
    city: string | null;
    zip: string | null;
    propertyType: string | null;
    yearBuilt: number | null;
    associationFee: number | null;
    daysOnMarket: number | null;
    hasPool: boolean;
    hasView: boolean;
    hasFireplace: boolean;
    agentName: string | null;
    officeName: string | null;
    text: string;
}
export interface FormattedSoldCard {
    listingKey: string;
    address: string | null;
    city: string | null;
    closeDate: string | null;
    closePrice: number | null;
    listPrice: number | null;
    priceDifference: number | null;
    daysOnMarket: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    propertyType: string | null;
    text: string;
}
export interface ActiveListingsResult {
    mode: "active";
    page: number;
    limit: number;
    hasMore: boolean;
    cards: FormattedActiveCard[];
    text: string;
}
export interface SoldCompsResult {
    mode: "sold";
    city: string;
    months: number;
    cards: FormattedSoldCard[];
    text: string;
}
export interface BothListingsResult {
    mode: "both";
    city: string;
    active: {
        page: number;
        limit: number;
        hasMore: boolean;
        cards: FormattedActiveCard[];
    };
    sold: {
        months: number;
        cards: FormattedSoldCard[];
    };
    text: string;
}
export interface QueryErrorResult {
    error: string;
}
export type QueryPropertyResult = ActiveListingsResult | SoldCompsResult | BothListingsResult | QueryErrorResult;
