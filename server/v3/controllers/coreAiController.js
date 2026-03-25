import CoreProperty from "../models/CoreProperty.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function summarizePrices(prices = []) {
  const valid = prices.filter((item) => Number.isFinite(item) && item > 0).sort((a, b) => a - b);
  if (!valid.length) return { avgPrice: 0, medianPrice: 0, count: 0 };
  const avgPrice = Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  const medianPrice = valid[Math.floor(valid.length / 2)];
  return { avgPrice, medianPrice, count: valid.length };
}

async function fetchAllProperties() {
  if (proRuntime.dbConnected) {
    const rows = await CoreProperty.find({}).lean();
    return rows;
  }
  return [...proMemoryStore.coreProperties];
}

function filterByLocality(rows = [], locality = "") {
  const needle = text(locality).toLowerCase();
  if (!needle) return rows;
  return rows.filter((item) =>
    `${text(item.city)} ${text(item.location)}`.toLowerCase().includes(needle)
  );
}

function buildMarketTrend(basePrice = 6000000) {
  return [5, 4, 3, 2, 1, 0].map((offset) => {
    const date = new Date();
    date.setMonth(date.getMonth() - offset);
    return {
      monthOffset: offset,
      monthLabel: date.toLocaleString("en-IN", { month: "short" }),
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      avgRate: Math.max(1000000, Math.round(basePrice * (1 + (offset - 2) * 0.015)))
    };
  });
}

export async function getCoreAiMarketTrend(req, res, next) {
  try {
    const locality = text(req.query.locality || req.query.name, "Udaipur");
    const allRows = await fetchAllProperties();
    const scopedRows = filterByLocality(allRows, locality);
    const finalRows = scopedRows.length ? scopedRows : allRows;
    const stats = summarizePrices(finalRows.map((item) => numberValue(item.price, 0)));
    const trend = buildMarketTrend(stats.avgPrice || stats.medianPrice || 6000000);

    return res.json({
      success: true,
      locality,
      stats: {
        locality,
        totalListings: finalRows.length,
        avgPrice: stats.avgPrice,
        medianPrice: stats.medianPrice
      },
      trend
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCoreAiPricingSuggestion(req, res, next) {
  try {
    const locality = text(req.body?.locality, "Udaipur");
    const expectedPrice = numberValue(req.body?.expectedPrice, 0);
    const allRows = await fetchAllProperties();
    const scopedRows = filterByLocality(allRows, locality);
    const finalRows = scopedRows.length ? scopedRows : allRows;
    const stats = summarizePrices(finalRows.map((item) => numberValue(item.price, 0)));

    const referencePrice = stats.avgPrice || stats.medianPrice || expectedPrice || 6000000;
    const suggested = expectedPrice > 0
      ? Math.round((referencePrice * 0.75) + (expectedPrice * 0.25))
      : referencePrice;
    const minBand = Math.max(0, Math.round(suggested * 0.88));
    const maxBand = Math.max(minBand, Math.round(suggested * 1.14));
    const confidence = clamp(
      50
        + (stats.count >= 5 ? 20 : 0)
        + (stats.count >= 10 ? 12 : 0)
        + (stats.avgPrice > 0 ? 8 : 0),
      40,
      95
    );

    return res.json({
      success: true,
      locality,
      avgPrice: stats.avgPrice,
      medianPrice: stats.medianPrice,
      recommendedPrice: suggested,
      suggestedBand: {
        min: minBand,
        max: maxBand
      },
      confidence,
      source: proRuntime.dbConnected ? "core-ai-mongodb" : "core-ai-memory",
      message: `Is area me average price ₹${stats.avgPrice.toLocaleString("en-IN")} hai. Suggested range ₹${minBand.toLocaleString("en-IN")} - ₹${maxBand.toLocaleString("en-IN")}.`
    });
  } catch (error) {
    return next(error);
  }
}

export function getCoreAiDescription(req, res, next) {
  try {
    const title = text(req.body?.title, "Property");
    const location = text(req.body?.location || req.body?.locality, "Udaipur");
    const category = text(req.body?.category, "Property");
    const type = text(req.body?.type, "buy");
    const price = numberValue(req.body?.price, 0);
    const bedrooms = text(req.body?.bedrooms);
    const bathrooms = text(req.body?.bathrooms);
    const size = text(req.body?.size || req.body?.areaSqft);
    const furnished = text(req.body?.furnished);

    const parts = [
      `${title} located in ${location}, Udaipur.`,
      `${category} available for ${type}${price > 0 ? ` at ₹${price.toLocaleString("en-IN")}` : ""}.`,
      size ? `Size: ${size}.` : "",
      bedrooms ? `Bedrooms: ${bedrooms}.` : "",
      bathrooms ? `Bathrooms: ${bathrooms}.` : "",
      furnished ? `Furnishing: ${furnished}.` : "",
      "Verified document workflow, AI fraud scan, and secure in-app communication enabled via PropertySetu."
    ].filter(Boolean);

    return res.json({
      success: true,
      description: parts.join(" ")
    });
  } catch (error) {
    return next(error);
  }
}

export function getCoreAiFraudScan(req, res, next) {
  try {
    const title = text(req.body?.title);
    const description = text(req.body?.description);
    const combinedText = `${title} ${description}`.toLowerCase();
    const expectedAveragePrice = numberValue(req.body?.expectedAveragePrice, 0);
    const price = numberValue(req.body?.price, 0);
    const photosCount = numberValue(req.body?.media?.photosCount, 0);
    const duplicatePhotoMatches = numberValue(req.body?.media?.duplicatePhotoMatches, 0);
    const blurryPhotosDetected = numberValue(req.body?.media?.blurryPhotosDetected, 0);
    const riskyWords = ["urgent sale", "cash only", "advance first", "no visit", "token now"];
    const riskyMatches = riskyWords.filter((word) => combinedText.includes(word));
    const suspiciousPricingAlert =
      expectedAveragePrice > 0 && price > 0 && price < Math.round(expectedAveragePrice * 0.38);

    const riskScore = clamp(
      (riskyMatches.length * 20)
        + (suspiciousPricingAlert ? 24 : 0)
        + (photosCount > 0 && photosCount < 5 ? 16 : 0)
        + (duplicatePhotoMatches > 0 ? 28 : 0)
        + (blurryPhotosDetected >= 3 ? 12 : 0),
      0,
      100
    );

    const fakeListingSignal =
      duplicatePhotoMatches > 0 ||
      suspiciousPricingAlert ||
      blurryPhotosDetected >= 3 ||
      riskyMatches.length >= 2;

    return res.json({
      success: true,
      scan: {
        fraudRiskScore: riskScore,
        duplicatePhotoDetected: duplicatePhotoMatches > 0,
        duplicatePhotoCount: duplicatePhotoMatches,
        suspiciousPricingAlert,
        fakeListingSignal,
        reasons: [
          ...riskyMatches.map((word) => `Contains risky phrase: "${word}"`),
          ...(suspiciousPricingAlert ? ["Price looks abnormally low for this locality"] : []),
          ...(photosCount > 0 && photosCount < 5 ? ["Minimum 5 photos recommended for trust"] : []),
          ...(duplicatePhotoMatches > 0 ? [`Duplicate photo match detected (${duplicatePhotoMatches})`] : []),
          ...(blurryPhotosDetected >= 3 ? ["Multiple blurry photos detected"] : [])
        ],
        recommendation:
          fakeListingSignal || riskScore > 60
            ? "Manual admin verification required"
            : "Looks normal"
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCoreAiRecommendations(req, res, next) {
  try {
    const locality = text(req.query.locality);
    const category = text(req.query.category, "all").toLowerCase();
    const excludeId = text(req.query.excludeId);
    const targetPrice = numberValue(req.query.price, 0);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 5)));

    const rows = await fetchAllProperties();
    let items = [...rows];
    if (locality) items = filterByLocality(items, locality);
    if (category && category !== "all") {
      items = items.filter((item) => text(item.category).toLowerCase() === category);
    }
    if (excludeId) {
      items = items.filter((item) => text(item._id || item.id) !== excludeId);
    }

    const scored = items.map((item) => {
      const price = numberValue(item.price, 0);
      const priceScore = targetPrice > 0 && price > 0
        ? clamp(20 - Math.round((Math.abs(price - targetPrice) / targetPrice) * 40), 0, 20)
        : 10;
      const verifiedBoost = item.verified ? 8 : 0;
      const score = clamp(
        Math.round(numberValue(item.trustScore, 62) + priceScore + verifiedBoost),
        35,
        100
      );
      return {
        id: text(item._id || item.id),
        title: text(item.title, "Property"),
        city: text(item.city, "Udaipur"),
        location: text(item.location, "Udaipur"),
        category: text(item.category, "house"),
        type: text(item.type, "buy"),
        price,
        verified: Boolean(item.verified),
        recommendationScore: score,
        recommendationReason:
          `${verifiedBoost ? "verified trust + " : ""}price similarity`
      };
    });

    scored.sort((a, b) => b.recommendationScore - a.recommendationScore || b.price - a.price);
    return res.json({
      success: true,
      total: scored.length,
      items: scored.slice(0, limit)
    });
  } catch (error) {
    return next(error);
  }
}
