import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreUser from "../models/CoreUser.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";

export async function getCoreHealth(_req, res, next) {
  try {
    if (proRuntime.dbConnected) {
      const [users, properties, reviews, subscriptions] = await Promise.all([
        CoreUser.countDocuments({}),
        CoreProperty.countDocuments({}),
        CoreReview.countDocuments({}),
        CoreSubscription.countDocuments({})
      ]);

      return res.json({
        success: true,
        mode: "mongodb",
        counts: { users, properties, reviews, subscriptions },
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      mode: "memory",
      counts: {
        users: proMemoryStore.coreUsers.length,
        properties: proMemoryStore.coreProperties.length,
        reviews: proMemoryStore.coreReviews.length,
        subscriptions: proMemoryStore.coreSubscriptions.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}
