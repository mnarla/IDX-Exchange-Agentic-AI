import type { PropertyFilter } from "./types.js";

export interface AdaptedFilterResult {
  whereClause: string;
  params: any[];
}

/**
 * Maps Week 2 structured PropertyFilter to rets_property WHERE conditions and parameter array.
 * Note: Zero string interpolation is performed. Every filter value is parameterized with `?`.
 */
export function adaptFiltersToSQL(filters?: Partial<PropertyFilter> | null): AdaptedFilterResult {
  let whereClause = "WHERE L_Status = ?";
  const params: any[] = ["Active"];

  if (!filters) {
    return { whereClause, params };
  }

  if (filters.city && typeof filters.city === "string" && filters.city.trim()) {
    whereClause += " AND L_City = ?";
    params.push(filters.city.trim());
  }

  if (typeof filters.maxPrice === "number" && !isNaN(filters.maxPrice)) {
    whereClause += " AND L_SystemPrice <= ?";
    params.push(filters.maxPrice);
  }

  if (typeof filters.minBeds === "number" && !isNaN(filters.minBeds)) {
    whereClause += " AND L_Keyword2 >= ?";
    params.push(filters.minBeds);
  }

  if (typeof filters.minBaths === "number" && !isNaN(filters.minBaths)) {
    whereClause += " AND LM_Dec_3 >= ?";
    params.push(filters.minBaths);
  }

  if (typeof filters.minSqft === "number" && !isNaN(filters.minSqft)) {
    whereClause += " AND LM_Int2_3 >= ?";
    params.push(filters.minSqft);
  }

  if (filters.type && typeof filters.type === "string" && filters.type.trim()) {
    whereClause += " AND L_Type_ = ?";
    params.push(filters.type.trim());
  }

  // Boolean storage in rets_property: '1' indicates presence of pool/view
  if (filters.pool === "True") {
    whereClause += " AND PoolPrivateYN = ?";
    params.push("1");
  }

  if (filters.hasView === "True") {
    whereClause += " AND ViewYN = ?";
    params.push("1");
  }

  if (typeof filters.maxHOA === "number" && !isNaN(filters.maxHOA)) {
    whereClause += " AND AssociationFee <= ?";
    params.push(filters.maxHOA);
  }

  return { whereClause, params };
}
