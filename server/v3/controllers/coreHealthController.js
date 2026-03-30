import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreUser from "../models/CoreUser.js";
import CoreMessage from "../models/CoreMessage.js";
import CoreUpload from "../models/CoreUpload.js";
import CoreOwnerVerification from "../models/CoreOwnerVerification.js";
import CorePropertyCareRequest from "../models/CorePropertyCareRequest.js";
import CoreWishlistItem from "../models/CoreWishlistItem.js";
import CoreVisitBooking from "../models/CoreVisitBooking.js";
import CoreNotification from "../models/CoreNotification.js";
import CoreSealedBid from "../models/CoreSealedBid.js";
import CorePrivateDocSecurityEvent from "../models/CorePrivateDocSecurityEvent.js";
import CorePrivateDocShieldBlock from "../models/CorePrivateDocShieldBlock.js";
import CorePrivateDocIntegrityDecisionAudit from "../models/CorePrivateDocIntegrityDecisionAudit.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";

export async function getCoreHealth(_req, res, next) {
  try {
    if (proRuntime.dbConnected) {
      const [users, properties, reviews, subscriptions, messages, uploads, ownerVerificationRequests, propertyCareRequests, wishlistItems, visitBookings, notifications, sealedBids, privateDocSecurityEvents, privateDocShieldBlocks, privateDocIntegrityDecisionAudits] = await Promise.all([
        CoreUser.countDocuments({}),
        CoreProperty.countDocuments({}),
        CoreReview.countDocuments({}),
        CoreSubscription.countDocuments({}),
        CoreMessage.countDocuments({}),
        CoreUpload.countDocuments({}),
        CoreOwnerVerification.countDocuments({}),
        CorePropertyCareRequest.countDocuments({}),
        CoreWishlistItem.countDocuments({}),
        CoreVisitBooking.countDocuments({}),
        CoreNotification.countDocuments({}),
        CoreSealedBid.countDocuments({}),
        CorePrivateDocSecurityEvent.countDocuments({}),
        CorePrivateDocShieldBlock.countDocuments({
          blockUntil: { $gt: new Date() }
        }),
        CorePrivateDocIntegrityDecisionAudit.countDocuments({})
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
          propertyCareRequests,
          wishlistItems,
          visitBookings,
          notifications,
          sealedBids,
          privateDocSecurityEvents,
          privateDocShieldBlocks,
          privateDocIntegrityDecisionAudits
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
        propertyCareRequests: proMemoryStore.corePropertyCareRequests.length,
        wishlistItems: proMemoryStore.coreWishlistItems.length,
        visitBookings: proMemoryStore.coreVisitBookings.length,
        notifications: proMemoryStore.coreNotifications.length,
        sealedBids: proMemoryStore.coreSealedBids.length,
        privateDocSecurityEvents: proMemoryStore.corePrivateDocAccessEvents.length + proMemoryStore.corePrivateDocShieldEvents.length,
        privateDocShieldBlocks: proMemoryStore.corePrivateDocShieldBlocks.length,
        privateDocIntegrityDecisionAudits: proMemoryStore.corePrivateDocIntegrityDecisionAudits.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}
