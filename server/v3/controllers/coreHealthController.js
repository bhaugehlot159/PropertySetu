import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreUser from "../models/CoreUser.js";
import CoreMessage from "../models/CoreMessage.js";
import CoreUpload from "../models/CoreUpload.js";
import CoreOwnerVerification from "../models/CoreOwnerVerification.js";
import CorePropertyCareRequest from "../models/CorePropertyCareRequest.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";

export async function getCoreHealth(_req, res, next) {
  try {
    if (proRuntime.dbConnected) {
      const [users, properties, reviews, subscriptions, messages, uploads, ownerVerificationRequests, propertyCareRequests] = await Promise.all([
        CoreUser.countDocuments({}),
        CoreProperty.countDocuments({}),
        CoreReview.countDocuments({}),
        CoreSubscription.countDocuments({}),
        CoreMessage.countDocuments({}),
        CoreUpload.countDocuments({}),
        CoreOwnerVerification.countDocuments({}),
        CorePropertyCareRequest.countDocuments({})
      ]);

      return res.json({
        success: true,
        mode: "mongodb",
        counts: {
          users,
          properties,
          reviews,
          subscriptions,
          messages,
          uploads,
          ownerVerificationRequests,
          propertyCareRequests
        },
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
        subscriptions: proMemoryStore.coreSubscriptions.length,
        messages: proMemoryStore.coreMessages.length,
        uploads: proMemoryStore.coreUploads.length,
        ownerVerificationRequests: proMemoryStore.coreOwnerVerificationRequests.length,
        propertyCareRequests: proMemoryStore.corePropertyCareRequests.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}
