# Week 8 live end-to-end results

Real Gemini embeddings → OpenClaw retrieval tool → configured answer model. All three checks passed.

## What does DOM mean?

DOM (Days on Market) measures calendar days between the ListingContractDate and when a property's status changes to Pending or the CloseDate [S16-S19, Real Estate Data Analysis Primer pp.6-7]. It's a direct demand indicator: low DOM (1–7 days) signals a hot market, high DOM (60+ days) signals soft demand or overpricing [S18-S19]. Typically calculated as calendar days between ListingContractDate and either Pending date or CloseDate, depending on the platform. Some MLS systems also track Cumulative Days on Market (CDOM), which adds DOM across multiple listing periods for the same property [S16].

## What columns are in california_sold?

**california_sold schema — columns grouped by source page** (AI Agentic Engineer Intern Handbook 2026):

- **[S3/S4] page 5**: ListingKey BIGINT, ClosePrice DOUBLE, CloseDate VARCHAR, OriginalListPrice DOUBLE, ListPrice DOUBLE, DaysOnMarket BIGINT, PropertyType VARCHAR, PropertySubType VARCHAR, LivingArea DOUBLE, LotSizeAcres DOUBLE, LotSizeSquareFeet DOUBLE, BedroomsTotal DOUBLE, BathroomsTotalInteger DOUBLE, YearBuilt DOUBLE

- **[S5] page 6**: City VARCHAR, PostalCode VARCHAR, Latitude DOUBLE, Longitude DOUBLE, UnparsedAddress VARCHAR, ListAgentFirstName VARCHAR, ListAgentLastName VARCHAR, ListAgentFullName VARCHAR, BuyerAgentFirstName VARCHAR, BuyerAgentLastName VARCHAR, ListOfficeName VARCHAR, BuyerOfficeName VARCHAR, PoolPrivateYN VARCHAR, ViewYN VARCHAR, FireplaceYN VARCHAR, NewConstructionYN VARCHAR, GarageSpaces DOUBLE, AssociationFee DOUBLE, SubdivisionName VARCHAR, HighSchoolDistrict VARCHAR, ListingContractDate VARCHAR, PurchaseContractDate VARCHAR

*Note: These are documented columns from the intern handbook; the actual MySQL schema (boxgra5_cali) may contain additional or omitted fields not listed here.*

## What is a list-to-close ratio?

List-to-close ratio = (Average ClosePrice / ListPrice at contract) × 100, a negotiating leverage indicator: >100% = seller leverage, <98% = buyer leverage [S94, Week 5 Market Analytics Architecture, Core Market Analytics Metrics]. Distinguishing list prices: ListPrice = list price at time of contract [S3, AI Agentic Engineer Intern Handbook 2026, page 5]; OriginalListPrice = original asking price when first listed [S3, same]. A ratio above 1.0 (close > list) signals competitive seller's market, typically from multiple competing offers driving price above asking [S11, Real Estate Data Analysis Primer, page 3].