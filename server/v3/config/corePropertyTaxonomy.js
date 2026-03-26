const CORE_PROPERTY_TYPE_OPTIONS = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "rent", label: "Rent" },
  { value: "lease", label: "Lease" },
  { value: "mortgage", label: "Girvi / Mortgage" },
  { value: "service", label: "Service" },
  { value: "auction", label: "Auction / Bid" }
];

const CORE_PROPERTY_CATEGORY_OPTIONS = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment / Flat" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot / Vadi" },
  { value: "farm-house", label: "Farm House" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop / Retail" },
  { value: "pg-hostel", label: "PG / Hostel" },
  { value: "warehouse", label: "Warehouse / Godown" },
  { value: "agriculture-land", label: "Agriculture Land" },
  { value: "property-care", label: "Property Care" },
  { value: "home-maintenance", label: "Home Maintenance" },
  { value: "home-watch", label: "Home Watch" },
  { value: "industrial", label: "Industrial" },
  { value: "co-living", label: "Co-living" },
  { value: "other", label: "Other" }
];

export const CORE_PROPERTY_TYPE_VALUES = CORE_PROPERTY_TYPE_OPTIONS.map((item) => item.value);
export const CORE_PROPERTY_CATEGORY_VALUES = CORE_PROPERTY_CATEGORY_OPTIONS.map(
  (item) => item.value
);

const CORE_PROPERTY_TYPE_SET = new Set(CORE_PROPERTY_TYPE_VALUES);
const CORE_PROPERTY_CATEGORY_SET = new Set(CORE_PROPERTY_CATEGORY_VALUES);

const TYPE_ALIASES = {
  buy: "buy",
  purchase: "buy",
  sell: "sell",
  resale: "sell",
  rent: "rent",
  rental: "rent",
  lease: "lease",
  leasing: "lease",
  mortgage: "mortgage",
  girvi: "mortgage",
  service: "service",
  "property care": "service",
  "home maintenance": "service",
  "home watch": "service",
  auction: "auction",
  bid: "auction",
  "sealed bid": "auction"
};

const CATEGORY_ALIASES = {
  house: "house",
  home: "house",
  residential: "house",
  apartment: "apartment",
  flat: "apartment",
  condo: "apartment",
  villa: "villa",
  plot: "plot",
  vadi: "plot",
  "vadi plot": "plot",
  "vadi / plot": "plot",
  "land plot": "plot",
  site: "plot",
  farmhouse: "farm-house",
  "farm house": "farm-house",
  commercial: "commercial",
  office: "office",
  shop: "shop",
  retail: "shop",
  pg: "pg-hostel",
  hostel: "pg-hostel",
  "pg hostel": "pg-hostel",
  "pg / hostel": "pg-hostel",
  warehouse: "warehouse",
  godown: "warehouse",
  "agriculture land": "agriculture-land",
  "agricultural land": "agriculture-land",
  "farm land": "agriculture-land",
  "property care": "property-care",
  "home maintenance": "home-maintenance",
  "home watch": "home-watch",
  industrial: "industrial",
  factory: "industrial",
  "co living": "co-living",
  coliving: "co-living",
  other: "other",
  misc: "other"
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeCorePropertyType(value, fallback = "buy") {
  const key = normalizeKey(value);
  const viaAlias = TYPE_ALIASES[key];
  if (viaAlias && CORE_PROPERTY_TYPE_SET.has(viaAlias)) return viaAlias;
  if (CORE_PROPERTY_TYPE_SET.has(key)) return key;
  return CORE_PROPERTY_TYPE_SET.has(fallback) ? fallback : "buy";
}

export function normalizeCorePropertyCategory(value, fallback = "house") {
  const key = normalizeKey(value);
  const viaAlias = CATEGORY_ALIASES[key];
  if (viaAlias && CORE_PROPERTY_CATEGORY_SET.has(viaAlias)) return viaAlias;
  if (CORE_PROPERTY_CATEGORY_SET.has(key)) return key;
  return CORE_PROPERTY_CATEGORY_SET.has(fallback) ? fallback : "house";
}

export function isSupportedCorePropertyType(value) {
  return CORE_PROPERTY_TYPE_SET.has(normalizeCorePropertyType(value, ""));
}

export function isSupportedCorePropertyCategory(value) {
  return CORE_PROPERTY_CATEGORY_SET.has(normalizeCorePropertyCategory(value, ""));
}

export function getCorePropertyTaxonomy() {
  return {
    types: CORE_PROPERTY_TYPE_OPTIONS,
    categories: CORE_PROPERTY_CATEGORY_OPTIONS
  };
}

