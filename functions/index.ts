import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled Firebase Cloud Function: checkDailySubscriptionExpiry
 * Runs every 24 hours to inspect user 'premiumStartDate' (and 'premiumSince').
 * If difference between current date and start date exceeds 365 days,
 * sets 'isPremium' to false in Firestore and updates the record to Free status.
 */
export const checkDailySubscriptionExpiry = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = new Date();
    const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;
    const THREE_HUNDRED_SIXTY_FIVE_DAYS_IN_MS = 365 * TWENTY_FOUR_HOURS_IN_MS;

    console.log(`[Cloud Function] Starting daily 365-day premium expiry check at ${now.toISOString()}`);

    try {
      // Query all users currently marked as isPremium == true
      const snapshot = await db
        .collection('users')
        .where('isPremium', '==', true)
        .get();

      if (snapshot.empty) {
        console.log('[Cloud Function] No active premium users found in Firestore.');
        return null;
      }

      const batch = db.batch();
      let expiredCount = 0;
      let activeCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const startRaw = data.premiumStartDate || data.premiumSince;

        if (!startRaw) {
          console.warn(`[Cloud Function] User ${doc.id} (${data.email}) is premium without a valid start date. Reverting to free.`);
          batch.update(doc.ref, {
            isPremium: false,
            subscriptionStatus: 'EXPIRED',
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          expiredCount++;
          continue;
        }

        const startDate = startRaw.toDate ? startRaw.toDate() : new Date(startRaw);
        const elapsedMs = now.getTime() - startDate.getTime();
        const elapsedDays = Math.floor(elapsedMs / TWENTY_FOUR_HOURS_IN_MS);

        if (elapsedMs >= THREE_HUNDRED_SIXTY_FIVE_DAYS_IN_MS || elapsedDays >= 365) {
          console.log(
            `[Cloud Function] Expiring user ${doc.id} (${data.email}): ${elapsedDays} days elapsed since ${startDate.toISOString()}`
          );
          
          batch.update(doc.ref, {
            isPremium: false,
            subscriptionStatus: 'EXPIRED',
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          expiredCount++;
        } else {
          activeCount++;
        }
      }

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`[Cloud Function] Successfully committed batch: ${expiredCount} users reverted to Free status.`);
      }

      console.log(`[Cloud Function] Expiry check summary: ${snapshot.size} inspected, ${activeCount} active, ${expiredCount} expired.`);
      return { total: snapshot.size, active: activeCount, expired: expiredCount };
    } catch (error) {
      console.error('[Cloud Function] Error executing daily subscription expiry check:', error);
      throw error;
    }
  });

/**
 * HTTPS Callable Cloud Function for Admin manual triggering or diagnostics
 */
export const triggerSubscriptionExpiryCheck = functions.https.onCall(async (data, context) => {
  // Verify Admin authorization
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  const isAdmin = userData?.role === 'ADMIN' || context.auth.token.email === 'jaan546jaan@gmail.com';

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can run manual expiry checks');
  }

  const now = new Date();
  const snapshot = await db.collection('users').where('isPremium', '==', true).get();
  const batch = db.batch();
  let expiredCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const startRaw = data.premiumStartDate || data.premiumSince;
    if (startRaw) {
      const startDate = startRaw.toDate ? startRaw.toDate() : new Date(startRaw);
      const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      if (elapsedDays >= 365) {
        batch.update(doc.ref, {
          isPremium: false,
          subscriptionStatus: 'EXPIRED',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        expiredCount++;
      }
    }
  }

  if (expiredCount > 0) {
    await batch.commit();
  }

  return { success: true, total: snapshot.size, expired: expiredCount };
});
