export interface SubscriptionDetails {
  isPremium: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'FREE' | 'ADMIN';
  premiumSince: string | null;
  premiumExpiresAt: string | null;
  daysRemaining: number | null;
  validityDays: number;
}

export function evaluateSubscription(user: {
  role?: string;
  isPremium?: boolean;
  premiumSince?: Date | string | null;
}): SubscriptionDetails {
  const isAdmin = user.role === 'ADMIN';

  if (isAdmin) {
    const since = user.premiumSince ? new Date(user.premiumSince).toISOString() : new Date().toISOString();
    return {
      isPremium: true,
      status: 'ADMIN',
      premiumSince: since,
      premiumExpiresAt: null,
      daysRemaining: null,
      validityDays: 365,
    };
  }

  if (!user.isPremium || !user.premiumSince) {
    return {
      isPremium: false,
      status: 'FREE',
      premiumSince: null,
      premiumExpiresAt: null,
      daysRemaining: 0,
      validityDays: 365,
    };
  }

  const startDate = new Date(user.premiumSince);
  if (isNaN(startDate.getTime())) {
    return {
      isPremium: false,
      status: 'FREE',
      premiumSince: null,
      premiumExpiresAt: null,
      daysRemaining: 0,
      validityDays: 365,
    };
  }

  // Exact 365 Days Subscription Duration
  const expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msRemaining = expiryDate.getTime() - now.getTime();

  if (msRemaining <= 0) {
    return {
      isPremium: false,
      status: 'EXPIRED',
      premiumSince: startDate.toISOString(),
      premiumExpiresAt: expiryDate.toISOString(),
      daysRemaining: 0,
      validityDays: 365,
    };
  }

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    isPremium: true,
    status: 'ACTIVE',
    premiumSince: startDate.toISOString(),
    premiumExpiresAt: expiryDate.toISOString(),
    daysRemaining,
    validityDays: 365,
  };
}
