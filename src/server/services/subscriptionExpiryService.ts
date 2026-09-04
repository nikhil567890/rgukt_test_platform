import { prisma } from '../db';

export interface ExpiryCheckResult {
  success: boolean;
  timestamp: string;
  totalChecked: number;
  activeCount: number;
  expiredCount: number;
  expiredUsers: Array<{
    id: string;
    name: string;
    email: string;
    elapsedDays: number;
    premiumStartDate: string;
  }>;
}

let lastCheckResult: ExpiryCheckResult | null = null;
let dailyCheckTimer: NodeJS.Timeout | null = null;

/**
 * Checks all users for premium subscription expiration.
 * If elapsed duration from premiumStartDate (or premiumSince) exceeds 365 days,
 * sets isPremium to false and reverts the user to Free status in the database.
 */
export async function checkAndExpireSubscriptions(): Promise<ExpiryCheckResult> {
  const now = new Date();
  console.log(`[Subscription Expiry Service] Running daily 365-day expiration check at ${now.toISOString()}...`);

  const expiredUsers: ExpiryCheckResult['expiredUsers'] = [];
  let totalChecked = 0;
  let activeCount = 0;
  let expiredCount = 0;

  try {
    // Process users from Primary Database
    const premiumStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        isPremium: true,
      },
    });

    for (const student of premiumStudents) {
      totalChecked++;
      const startDateRaw = student.premiumSince;
      
      if (!startDateRaw) {
        // Missing start date on a premium account -> reset to free
        await revertStudentToFree(student.id, student.name, student.email, 'Missing premium start date', 366);
        expiredUsers.push({
          id: student.id,
          name: student.name,
          email: student.email,
          elapsedDays: 366,
          premiumStartDate: 'Unknown',
        });
        expiredCount++;
        continue;
      }

      const startDate = new Date(startDateRaw);
      const elapsedMs = now.getTime() - startDate.getTime();
      const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

      // If duration exceeds 365 days (365 * 24 * 60 * 60 * 1000 ms)
      if (elapsedDays >= 365 || elapsedMs >= 365 * 24 * 60 * 60 * 1000) {
        console.log(`[Subscription Expiry Service] Student "${student.name}" (${student.email}) subscription has elapsed ${elapsedDays} days (> 365 days). Reverting to Free.`);
        await revertStudentToFree(student.id, student.name, student.email, `Exceeded 365 days (${elapsedDays} days since activation)`, elapsedDays, startDate.toISOString());
        
        expiredUsers.push({
          id: student.id,
          name: student.name,
          email: student.email,
          elapsedDays,
          premiumStartDate: startDate.toISOString(),
        });
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    lastCheckResult = {
      success: true,
      timestamp: now.toISOString(),
      totalChecked,
      activeCount,
      expiredCount,
      expiredUsers,
    };

    console.log(
      `[Subscription Expiry Service] Completed check: ${totalChecked} checked, ${activeCount} active, ${expiredCount} expired & reverted.`
    );

    return lastCheckResult;
  } catch (err: any) {
    console.error('[Subscription Expiry Service] Error during daily expiration check:', err);
    const failureResult: ExpiryCheckResult = {
      success: false,
      timestamp: now.toISOString(),
      totalChecked,
      activeCount,
      expiredCount,
      expiredUsers,
    };
    lastCheckResult = failureResult;
    return failureResult;
  }
}

/**
 * Reverts a student account to Free status in Database and logs an audit entry.
 */
async function revertStudentToFree(
  userId: string,
  userName: string,
  userEmail: string,
  reason: string,
  _elapsedDays: number,
  startDateStr?: string
) {
  // 1. Update Database
  await prisma.user.update({
    where: { id: userId },
    data: {
      isPremium: false,
    },
  });

  // 2. Log Audit Entry
  try {
    await prisma.auditLog.create({
      data: {
        action: 'AUTO_EXPIRE_PREMIUM_365_DAYS',
        details: `Automatic Daily Service reverted student "${userName}" (${userEmail}) to Free Tier. Reason: ${reason}. Active since: ${startDateStr || 'N/A'}.`,
        adminName: 'SYSTEM_SUBSCRIPTION_DAEMON',
      },
    });
  } catch (auditErr) {
    console.warn('[Subscription Expiry Service] Failed to create audit log:', auditErr);
  }
}

/**
 * Starts the daily automated recurring background service.
 * Runs once upon startup and repeats every 24 hours.
 */
export function startDailySubscriptionExpiryCron() {
  if (dailyCheckTimer) {
    clearInterval(dailyCheckTimer);
  }

  // Run initial check after 5 seconds of server startup
  setTimeout(() => {
    checkAndExpireSubscriptions().catch((err) => {
      console.error('[Subscription Expiry Service] Initial check error:', err);
    });
  }, 5000);

  // Set recurring interval every 24 hours (86,400,000 milliseconds)
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  dailyCheckTimer = setInterval(() => {
    checkAndExpireSubscriptions().catch((err) => {
      console.error('[Subscription Expiry Service] Scheduled check error:', err);
    });
  }, TWENTY_FOUR_HOURS_MS);

  console.log('[Subscription Expiry Service] Daily 365-day subscription expiration daemon scheduled.');
}

/**
 * Gets the latest check status report.
 */
export function getLastExpiryCheckStatus(): ExpiryCheckResult | null {
  return lastCheckResult;
}

