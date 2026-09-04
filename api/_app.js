// src/server/app.ts
import express from "express";

// src/server/routes/authRoutes.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// src/server/db.ts
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
dotenv.config();
var isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  if (isProduction) {
    throw new Error(
      "CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL environment variable is missing in production. Ephemeral /tmp or unconfigured databases are disabled in production. You must configure a persistent PostgreSQL DATABASE_URL (e.g. Supabase, Neon, AWS RDS) in your Vercel Project Settings."
    );
  }
  const devDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  process.env.DATABASE_URL = `file:${devDbPath}?connection_limit=1`;
} else if (isProduction && (process.env.DATABASE_URL.startsWith("file:") || process.env.DATABASE_URL.includes("/tmp/"))) {
  throw new Error(
    "CRITICAL DATABASE CONFIGURATION ERROR: Ephemeral SQLite file database is not allowed in production serverless environments. Please configure a persistent PostgreSQL DATABASE_URL in your Vercel Project Settings."
  );
}
var dbUrl = process.env.DATABASE_URL;
var globalForDb = globalThis;
function createPrismaClient() {
  if (globalForDb.prisma) {
    return globalForDb.prisma;
  }
  let adapter;
  if (dbUrl.startsWith("postgresql:") || dbUrl.startsWith("postgres:")) {
    adapter = new PrismaPg({ connectionString: dbUrl });
  } else {
    const sqliteFilePath = dbUrl.replace(/^file:/, "").split("?")[0];
    adapter = new PrismaBetterSqlite3({ url: sqliteFilePath });
  }
  const client = new PrismaClient({ adapter });
  if (dbUrl.startsWith("file:")) {
    client.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {
    });
    client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {
    });
  }
  globalForDb.prisma = client;
  return client;
}
var prisma = createPrismaClient();
async function checkDatabaseHealth() {
  const provider = dbUrl.startsWith("postgres") ? "postgresql" : "sqlite";
  try {
    await prisma.$queryRawUnsafe("SELECT 1 as connected");
    return { ok: true, provider };
  } catch (err) {
    console.error("[Database Health Check Failed]:", err?.message || err);
    return { ok: false, provider };
  }
}

// src/server/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path2 from "path";

// src/server/subscription.ts
function evaluateSubscription(user) {
  const isAdmin = user.role === "ADMIN";
  if (isAdmin) {
    const since = user.premiumSince ? new Date(user.premiumSince).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    return {
      isPremium: true,
      status: "ADMIN",
      premiumSince: since,
      premiumExpiresAt: null,
      daysRemaining: null,
      validityDays: 365
    };
  }
  if (!user.isPremium || !user.premiumSince) {
    return {
      isPremium: false,
      status: "FREE",
      premiumSince: null,
      premiumExpiresAt: null,
      daysRemaining: 0,
      validityDays: 365
    };
  }
  const startDate = new Date(user.premiumSince);
  if (isNaN(startDate.getTime())) {
    return {
      isPremium: false,
      status: "FREE",
      premiumSince: null,
      premiumExpiresAt: null,
      daysRemaining: 0,
      validityDays: 365
    };
  }
  const expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1e3);
  const now = /* @__PURE__ */ new Date();
  const msRemaining = expiryDate.getTime() - now.getTime();
  if (msRemaining <= 0) {
    return {
      isPremium: false,
      status: "EXPIRED",
      premiumSince: startDate.toISOString(),
      premiumExpiresAt: expiryDate.toISOString(),
      daysRemaining: 0,
      validityDays: 365
    };
  }
  const daysRemaining = Math.ceil(msRemaining / (1e3 * 60 * 60 * 24));
  return {
    isPremium: true,
    status: "ACTIVE",
    premiumSince: startDate.toISOString(),
    premiumExpiresAt: expiryDate.toISOString(),
    daysRemaining,
    validityDays: 365
  };
}

// src/server/utils/dbErrorHandler.ts
import { Prisma } from "@prisma/client";
function isDatabaseError(err) {
  if (!err) return false;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return true;
  if (err instanceof Prisma.PrismaClientUnknownRequestError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientValidationError) return true;
  if (typeof err.code === "string" && (err.code.startsWith("P") || err.code.startsWith("42") || err.code === "ECONNREFUSED")) {
    return true;
  }
  if (typeof err.name === "string" && err.name.includes("Prisma")) return true;
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("table") || msg.includes("relation") || msg.includes("database") || msg.includes("prisma") || msg.includes("connection refused") || msg.includes("p2021")) {
    return true;
  }
  return false;
}
function sanitizeErrorString(val) {
  if (typeof val === "string") {
    return val.replace(/postgres(ql)?:\/\/[^@\s]+@/gi, "postgres://***:***@");
  }
  return val;
}
function handleDatabaseError(err, res, fallbackMessage = "Internal server error") {
  const isDb = isDatabaseError(err);
  console.error("[DATABASE DIAGNOSTIC LOG]:", {
    name: err?.name,
    code: err?.code,
    message: sanitizeErrorString(err?.message),
    isDatabaseError: isDb
  });
  if (isDb) {
    res.status(503).json({
      error: "Database temporarily unavailable"
    });
    return;
  }
  res.status(500).json({
    error: fallbackMessage
  });
}

// src/server/auth.ts
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production. You must configure JWT_SECRET in your Vercel Environment Variables."
      );
    }
    console.warn("[SECURITY NOTICE] JWT_SECRET is not set in environment. Running in local development mode with temporary fallback secret. Set JWT_SECRET in .env for production.");
    return "dev-local-temporary-jwt-secret-not-for-production";
  }
  return secret.trim();
}
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, isPremium: user.isPremium },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}
var cachedFirebaseConfig = null;
function getFirebaseConfig() {
  if (cachedFirebaseConfig) return cachedFirebaseConfig;
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "";
  let apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
  try {
    const configPath = path2.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (!projectId && parsed.projectId) projectId = parsed.projectId;
      if (!apiKey && parsed.apiKey) apiKey = parsed.apiKey;
    }
  } catch (err) {
    console.warn("Notice reading firebase-applet-config.json:", err);
  }
  if (!projectId) projectId = "gen-lang-client-0891492608";
  if (!apiKey) apiKey = "AIzaSyBKwIQiz76hzF68XmMF2LyWVIWoDg-55So";
  cachedFirebaseConfig = { projectId, apiKey };
  return cachedFirebaseConfig;
}
async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== "string" || token.split(".").length !== 3) {
    return null;
  }
  const { projectId, apiKey } = getFirebaseConfig();
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.payload) {
    return null;
  }
  const payload = decoded.payload;
  const nowInSeconds = Math.floor(Date.now() / 1e3);
  if (payload.exp && payload.exp < nowInSeconds) {
    return null;
  }
  const isFirebaseIssuer = typeof payload.iss === "string" && payload.iss.includes("securetoken.google.com");
  const isCorrectAudience = !projectId || payload.aud === projectId;
  if (!isFirebaseIssuer && !isCorrectAudience) {
    return null;
  }
  if (apiKey) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token })
        }
      );
      if (response.ok) {
        const data = await response.json();
        const fbUser = data?.users?.[0];
        if (fbUser && fbUser.email) {
          return {
            uid: fbUser.localId,
            email: fbUser.email.toLowerCase().trim(),
            name: fbUser.displayName || payload.name || fbUser.email.split("@")[0]
          };
        }
      }
    } catch (netErr) {
      console.warn("Google Identity Toolkit lookup notice:", netErr);
    }
  }
  if (isFirebaseIssuer && isCorrectAudience && payload.email) {
    return {
      uid: payload.sub || payload.user_id || `fb_${Date.now()}`,
      email: String(payload.email).toLowerCase().trim(),
      name: payload.name || payload.email.split("@")[0]
    };
  }
  return null;
}
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Access token missing" });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    return next();
  } catch (err) {
    try {
      const fbUser = await verifyFirebaseIdToken(token);
      if (fbUser && fbUser.email) {
        const normalizedEmail = fbUser.email.toLowerCase().trim();
        const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);
        let dbUser = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        });
        if (!dbUser) {
          const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
          dbUser = await prisma.user.create({
            data: {
              name: fbUser.name || normalizedEmail.split("@")[0],
              email: normalizedEmail,
              password: randomPassword,
              role: isAdmin ? "ADMIN" : "STUDENT",
              isPremium: isAdmin,
              premiumSince: isAdmin ? /* @__PURE__ */ new Date() : null
            }
          });
        } else if (isAdmin && (dbUser.role !== "ADMIN" || !dbUser.isPremium)) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { role: "ADMIN", isPremium: true, premiumSince: /* @__PURE__ */ new Date() }
          });
        }
        const sub = evaluateSubscription(dbUser);
        const appPayload = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          isPremium: sub.isPremium
        };
        req.user = appPayload;
        const upgradedToken = generateToken(appPayload);
        res.setHeader("x-application-token", upgradedToken);
        res.setHeader("Access-Control-Expose-Headers", "x-application-token");
        return next();
      }
    } catch (fbErr) {
      if (isDatabaseError(fbErr)) {
        handleDatabaseError(fbErr, res, "Database error during token authentication");
        return;
      }
      console.warn("Firebase token verification error in authenticateToken:", fbErr);
    }
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
var ADMIN_EMAILS = [
  "admin@rgukt.ac.in",
  "rvinodh45@gmail.com",
  "avinashinapakurthi31@gmail.com",
  "jaan546jaan@gmail.com"
];
async function requireAdmin(req, res, next) {
  if (!req.user || !req.user.id) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true }
    });
    if (!dbUser) {
      res.status(401).json({ error: "User account not found" });
      return;
    }
    const userEmail = dbUser.email?.toLowerCase().trim();
    const isAuthorizedEmail = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;
    if (dbUser.role !== "ADMIN" && !isAuthorizedEmail) {
      res.status(403).json({ error: "Admin authorization required" });
      return;
    }
    req.user.role = "ADMIN";
    next();
  } catch (err) {
    if (isDatabaseError(err)) {
      handleDatabaseError(err, res, "Database error verifying admin privileges");
      return;
    }
    console.error("Database query error in requireAdmin:", err);
    res.status(500).json({ error: "Failed to verify admin authorization" });
  }
}
async function requirePremium(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.role === "ADMIN") {
    next();
    return;
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isPremium: true, premiumSince: true, role: true }
    });
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if (dbUser.role === "ADMIN") {
      req.user.role = "ADMIN";
      req.user.isPremium = true;
      next();
      return;
    }
    const sub = evaluateSubscription(dbUser);
    if (sub.isPremium) {
      req.user.isPremium = true;
      next();
      return;
    }
    if (dbUser.isPremium && sub.status === "EXPIRED") {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { isPremium: false }
      });
      req.user.isPremium = false;
      res.status(402).json({
        code: "PREMIUM_EXPIRED",
        error: "Your 365-day Premium membership subscription has expired. Please renew your subscription to continue."
      });
      return;
    }
  } catch (err) {
    console.error("Database query error in requirePremium:", err);
  }
  res.status(402).json({
    code: "PREMIUM_REQUIRED",
    error: "Premium subscription required. Please activate or renew your \u20B93000 subscription for 365 days of full platform access."
  });
}

// src/server/routes/authRoutes.ts
var router = Router();
function isKnownAdminEmail(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      res.status(400).json({ error: "User with this email already exists" });
      return;
    }
    const hashedPassword = await bcrypt2.hash(password, 10);
    const isAdminEmail = isKnownAdminEmail(normalizedEmail);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: isAdminEmail ? "ADMIN" : "STUDENT",
        isPremium: isAdminEmail ? true : false,
        premiumSince: isAdminEmail ? /* @__PURE__ */ new Date() : null
      }
    });
    const sub = evaluateSubscription(user);
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium
    });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        subscription: sub
      }
    });
  } catch (err) {
    handleDatabaseError(err, res, "Server error during registration");
  }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const isMatch = await bcrypt2.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (isKnownAdminEmail(normalizedEmail) && (user.role !== "ADMIN" || !user.isPremium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", isPremium: true, premiumSince: /* @__PURE__ */ new Date() }
      });
    }
    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === "EXPIRED") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false }
      });
      sub = evaluateSubscription(user);
    }
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        subscription: sub
      }
    });
  } catch (err) {
    handleDatabaseError(err, res, "Server error during login");
  }
});
var handleGoogleAuth = async (req, res) => {
  try {
    const idToken = req.body?.idToken;
    let email = req.body?.email || req.query?.email;
    let name = req.body?.name || req.query?.name;
    const authHeader = req.headers["authorization"];
    const bearerToken = authHeader && authHeader.split(" ")[1];
    const candidateIdToken = idToken || (bearerToken && bearerToken.split(".").length === 3 ? bearerToken : null);
    if (candidateIdToken && typeof candidateIdToken === "string") {
      const verifiedFb = await verifyFirebaseIdToken(candidateIdToken);
      if (verifiedFb && verifiedFb.email) {
        email = verifiedFb.email;
        if (!name || name === "Google Student") {
          name = verifiedFb.name || email.split("@")[0];
        }
      } else if (idToken) {
        res.status(401).json({ error: "Invalid or expired Firebase authentication token" });
        return;
      }
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "Valid email address is required for Google Sign-In" });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const isAdminEmail = isKnownAdminEmail(normalizedEmail);
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (!user) {
      const displayName = typeof name === "string" && name.trim() ? name.trim() : normalizedEmail.split("@")[0];
      const randomPassword = await bcrypt2.hash(Math.random().toString(36) + Date.now(), 10);
      user = await prisma.user.create({
        data: {
          name: displayName,
          email: normalizedEmail,
          password: randomPassword,
          role: isAdminEmail ? "ADMIN" : "STUDENT",
          isPremium: isAdminEmail ? true : false,
          premiumSince: isAdminEmail ? /* @__PURE__ */ new Date() : null
        }
      });
    } else if (isAdminEmail && (user.role !== "ADMIN" || !user.isPremium)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", isPremium: true, premiumSince: /* @__PURE__ */ new Date() }
      });
    }
    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === "EXPIRED") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false }
      });
      sub = evaluateSubscription(user);
    }
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: sub.isPremium
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: sub.isPremium,
        premiumSince: user.premiumSince,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        createdAt: user.createdAt,
        subscription: sub
      }
    });
  } catch (err) {
    handleDatabaseError(err, res, "Server error during Google Sign-In");
  }
};
router.post("/google", handleGoogleAuth);
router.get("/google", handleGoogleAuth);
router.all("/google", (req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  if (req.method === "POST" || req.method === "GET") {
    return handleGoogleAuth(req, res);
  }
  next();
});
router.get("/me", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true
      }
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.email && isKnownAdminEmail(user.email) && (user.role !== "ADMIN" || !user.isPremium)) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", isPremium: true, premiumSince: /* @__PURE__ */ new Date() },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true
        }
      });
      user = updated;
    }
    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === "EXPIRED") {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true
        }
      });
      user = updated;
      sub = evaluateSubscription(user);
    }
    res.json({ user: { ...user, isPremium: sub.isPremium, subscription: sub } });
  } catch (err) {
    handleDatabaseError(err, res, "Server error fetching user details");
  }
});
router.get("/account-details", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true
      }
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let sub = evaluateSubscription(user);
    if (user.isPremium && sub.status === "EXPIRED") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isPremium: true,
          premiumSince: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true
        }
      });
      sub = evaluateSubscription(user);
    }
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        amount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const formattedPayments = payments.map((p) => ({
      ...p,
      amountINR: p.amount / 100,
      // convert paise to INR
      paymentMethod: p.razorpayPaymentId ? "Razorpay Gateway" : "Manual / Offline Verification",
      purpose: "RGUKT CET Mathematics TestPrep 365-Day Subscription"
    }));
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak
      },
      subscription: sub,
      payments: formattedPayments
    });
  } catch (err) {
    handleDatabaseError(err, res, "Failed to retrieve account and payment details");
  }
});
var authRoutes_default = router;

// src/server/routes/paymentRoutes.ts
import { Router as Router2 } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
var router2 = Router2();
var RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_sampleKey123";
var RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "sampleSecretKey456";
var PREMIUM_AMOUNT = parseInt(process.env.PREMIUM_AMOUNT_PAISE || "300000", 10);
var razorpayInstance = null;
try {
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes("sampleKey")) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
  }
} catch (e) {
  console.log("Razorpay initialization fallback to simulation mode");
}
router2.post("/create-order", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.role === "ADMIN") {
      res.status(400).json({ error: "Administrator accounts already have permanent full access." });
      return;
    }
    if (user?.isPremium) {
      const sub = evaluateSubscription(user);
      if (sub.isPremium && (sub.daysRemaining ?? 0) > 30) {
        res.status(400).json({
          error: `You already have an active 365-day Premium subscription with ${sub.daysRemaining} days remaining. Early renewal is available within the final 30 days.`
        });
        return;
      }
    }
    let orderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
    if (razorpayInstance) {
      try {
        const order = await razorpayInstance.orders.create({
          amount: PREMIUM_AMOUNT,
          currency: "INR",
          receipt: `rcpt_${req.user.id.substring(0, 8)}_${Date.now()}`,
          notes: {
            userId: req.user.id,
            purpose: "RGUKT TestPrep Premium Membership"
          }
        });
        orderId = order.id;
      } catch (err) {
        console.warn("Razorpay live order creation failed, falling back to local simulation order:", err);
      }
    }
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: orderId,
        amount: PREMIUM_AMOUNT,
        status: "CREATED"
      }
    });
    res.json({
      orderId,
      amount: PREMIUM_AMOUNT,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      user: {
        name: user?.name,
        email: user?.email
      }
    });
  } catch (err) {
    console.error("Error creating payment order:", err);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});
router2.post("/verify", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId) {
      res.status(400).json({ error: "Missing payment details for verification" });
      return;
    }
    let isSignatureValid = false;
    const isProduction2 = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    if (isProduction2) {
      if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.includes("sampleSecret")) {
        res.status(500).json({ error: "Razorpay payment gateway secret is not configured on production server" });
        return;
      }
      if (!razorpaySignature) {
        res.status(400).json({ error: "Missing payment signature" });
        return;
      }
      const generatedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
      const generatedBuf = Buffer.from(generatedSignature, "utf8");
      const signatureBuf = Buffer.from(razorpaySignature, "utf8");
      isSignatureValid = generatedBuf.length === signatureBuf.length && crypto.timingSafeEqual(generatedBuf, signatureBuf);
    } else {
      if (razorpaySignature && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_SECRET.includes("sampleSecret")) {
        const generatedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
        isSignatureValid = generatedSignature === razorpaySignature;
      } else {
        isSignatureValid = true;
      }
    }
    if (!isSignatureValid) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId }
    });
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: "PAID"
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          userId: req.user.id,
          razorpayOrderId,
          razorpayPaymentId,
          amount: PREMIUM_AMOUNT,
          status: "PAID"
        }
      });
    }
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPremium: true,
        premiumSince: /* @__PURE__ */ new Date()
      }
    });
    const newToken = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isPremium: true
    });
    res.json({
      success: true,
      message: "Payment verified successfully! Welcome to RGUKT TestPrep Premium.",
      isPremium: true,
      token: newToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isPremium: updatedUser.isPremium,
        premiumSince: updatedUser.premiumSince
      }
    });
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});
router2.get("/status", authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, isPremium: true, premiumSince: true }
    });
    const sub = user ? evaluateSubscription(user) : {
      isPremium: false,
      status: "FREE",
      premiumSince: null,
      premiumExpiresAt: null,
      daysRemaining: 0,
      validityDays: 365
    };
    res.json({
      isPremium: sub.isPremium,
      premiumSince: sub.premiumSince,
      subscription: sub
    });
  } catch (err) {
    res.status(500).json({ error: "Error checking payment status" });
  }
});
var paymentRoutes_default = router2;

// src/server/routes/testRoutes.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.use(authenticateToken);
router3.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    const tests = await prisma.test.findMany({
      where: { isPublished: true },
      include: {
        _count: { select: { questions: true, attempts: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const userAttempts = userId ? await prisma.attempt.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" }
    }) : [];
    const formattedTests = tests.map((t) => {
      const attemptsForTest = userAttempts.filter((a) => a.testId === t.id);
      const lastAttempt = attemptsForTest[0];
      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks,
        createdAt: t.createdAt,
        questionCount: t._count.questions,
        totalAttemptsCount: t._count.attempts,
        isAttempted: attemptsForTest.length > 0,
        userAttemptsCount: attemptsForTest.length,
        userLastScore: lastAttempt ? lastAttempt.score : null,
        userLastPercentage: lastAttempt ? Math.round(lastAttempt.score / lastAttempt.totalMarks * 100) : null
      };
    });
    res.json({ tests: formattedTests });
  } catch (err) {
    console.error("Error fetching tests:", err);
    res.status(500).json({ error: "Failed to fetch test papers" });
  }
});
router3.get("/me/dashboard", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User ID missing" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        lastAttemptDay: true
      }
    });
    const attempts = await prisma.attempt.findMany({
      where: { userId },
      include: {
        test: {
          select: { id: true, title: true, subject: true, totalMarks: true }
        }
      },
      orderBy: { submittedAt: "desc" }
    });
    const attemptsWithTopper = await Promise.all(
      attempts.map(async (a) => {
        const topperMax = await prisma.attempt.aggregate({
          where: { testId: a.testId },
          _max: { score: true }
        });
        const topperScore = topperMax._max.score ?? a.score;
        const percentage = Math.round(a.score / a.totalMarks * 100);
        return {
          id: a.id,
          testId: a.testId,
          testTitle: a.test.title,
          subject: a.test.subject,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage,
          timeTakenSec: a.timeTakenSec,
          submittedAt: a.submittedAt,
          topperScore,
          gapToTopper: topperScore - a.score
        };
      })
    );
    const totalAvailableTests = await prisma.test.count({
      where: { isPublished: true }
    });
    const totalAttemptsCount = attempts.length;
    const avgScorePercentage = totalAttemptsCount > 0 ? Math.round(
      attemptsWithTopper.reduce((acc, curr) => acc + curr.percentage, 0) / totalAttemptsCount
    ) : 0;
    const subjectMap = {};
    attemptsWithTopper.forEach((a) => {
      const subj = a.subject || "General Studies";
      if (!subjectMap[subj]) {
        subjectMap[subj] = { subject: subj, attemptCount: 0, percentages: [], totalScore: 0, totalMarks: 0 };
      }
      subjectMap[subj].attemptCount += 1;
      subjectMap[subj].percentages.push(a.percentage);
      subjectMap[subj].totalScore += a.score;
      subjectMap[subj].totalMarks += a.totalMarks;
    });
    const subjectBreakdown = Object.values(subjectMap).map((item) => ({
      subject: item.subject,
      attemptCount: item.attemptCount,
      avgPercentage: Math.round(item.percentages.reduce((s, p) => s + p, 0) / item.attemptCount),
      highestPercentage: Math.max(...item.percentages),
      totalScore: item.totalScore,
      totalMarks: item.totalMarks
    }));
    const totalTimeSpentSec = attemptsWithTopper.reduce((sum, a) => sum + (a.timeTakenSec || 0), 0);
    const totalMarksSum = attemptsWithTopper.reduce((sum, a) => sum + a.totalMarks, 0);
    const analytics = {
      totalExamsWritten: totalAttemptsCount,
      avgPercentage: avgScorePercentage,
      highestPercentage: totalAttemptsCount > 0 ? Math.max(...attemptsWithTopper.map((a) => a.percentage)) : 0,
      totalTimeSpentSec,
      avgTimePerQuestionSec: totalMarksSum > 0 ? Math.round(totalTimeSpentSec / totalMarksSum) : 0,
      strongSubjects: subjectBreakdown.filter((s) => s.avgPercentage >= 70).map((s) => s.subject),
      weakSubjects: subjectBreakdown.filter((s) => s.avgPercentage < 50).map((s) => s.subject),
      accuracyRating: avgScorePercentage >= 80 ? "Excellent" : avgScorePercentage >= 65 ? "Good" : avgScorePercentage >= 50 ? "Average" : "Needs Improvement",
      subjectBreakdown
    };
    res.json({
      user,
      stats: {
        totalAvailableTests,
        totalAttemptsCount,
        avgScorePercentage,
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0
      },
      attemptsHistory: attemptsWithTopper,
      analytics
    });
  } catch (err) {
    console.error("Error fetching student dashboard:", err);
    res.status(500).json({ error: "Failed to fetch student dashboard data" });
  }
});
router3.get("/question-bank", requirePremium, async (req, res) => {
  try {
    const { subject, search } = req.query;
    const whereClause = {
      test: { isPublished: true }
    };
    if (subject && typeof subject === "string" && subject !== "ALL") {
      whereClause.test = {
        isPublished: true,
        subject: { equals: subject }
      };
    }
    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { questionText: { contains: searchTerm } },
        { optionA: { contains: searchTerm } },
        { optionB: { contains: searchTerm } },
        { optionC: { contains: searchTerm } },
        { optionD: { contains: searchTerm } },
        { explanation: { contains: searchTerm } }
      ];
    }
    const questions = await prisma.question.findMany({
      where: whereClause,
      include: {
        test: { select: { id: true, title: true, subject: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ questions });
  } catch (err) {
    console.error("Error fetching student question bank:", err);
    res.status(500).json({ error: "Failed to fetch question bank" });
  }
});
router3.get("/subjects-topics", async (req, res) => {
  try {
    const publishedTests = await prisma.test.findMany({
      where: { isPublished: true },
      include: {
        questions: true
      },
      orderBy: { createdAt: "desc" }
    });
    const coreSubjects = [
      { name: "Mathematics", code: "MATH", color: "bg-indigo-600" },
      { name: "Algebra & Polynomials", code: "ALG", color: "bg-blue-600" },
      { name: "Trigonometry & Applications", code: "TRIG", color: "bg-purple-600" },
      { name: "Coordinate Geometry", code: "COORD", color: "bg-emerald-600" },
      { name: "Mensuration & Statistics", code: "STAT", color: "bg-amber-600" }
    ];
    const result = coreSubjects.map((core) => {
      const testsInSubject = publishedTests.filter(
        (t) => core.name === "Mathematics" || t.subject.toLowerCase().includes(core.name.toLowerCase()) || core.name.toLowerCase().includes(t.subject.toLowerCase())
      );
      const totalQuestionsInSubject = testsInSubject.reduce(
        (sum, t) => sum + t.questions.length,
        0
      );
      const topics = testsInSubject.map((t) => ({
        id: t.id,
        title: t.title,
        questionCount: t.questions.length,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks
      }));
      return {
        id: `sub-${core.code.toLowerCase()}`,
        name: core.name,
        code: core.code,
        color: core.color,
        testCount: testsInSubject.length,
        totalQuestions: totalQuestionsInSubject,
        topics,
        tests: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks,
          questionCount: t.questions.length
        }))
      };
    });
    const extraSubjectNames = Array.from(
      new Set(
        publishedTests.map((t) => t.subject).filter(
          (s) => !coreSubjects.some(
            (c) => c.name.toLowerCase() === s.toLowerCase()
          )
        )
      )
    );
    extraSubjectNames.forEach((sName) => {
      const testsInSubject = publishedTests.filter((t) => t.subject === sName);
      const totalQuestionsInSubject = testsInSubject.reduce(
        (sum, t) => sum + t.questions.length,
        0
      );
      result.push({
        id: `sub-${sName.toLowerCase().replace(/\s+/g, "-")}`,
        name: sName,
        code: sName.substring(0, 4).toUpperCase(),
        color: "bg-rose-500",
        testCount: testsInSubject.length,
        totalQuestions: totalQuestionsInSubject,
        topics: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          questionCount: t.questions.length,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks
        })),
        tests: testsInSubject.map((t) => ({
          id: t.id,
          title: t.title,
          durationMin: t.durationMin,
          totalMarks: t.totalMarks,
          questionCount: t.questions.length
        }))
      });
    });
    res.json({ subjects: result });
  } catch (err) {
    console.error("Error fetching subjects & topics:", err);
    res.status(500).json({ error: "Failed to fetch subjects and topics" });
  }
});
router3.get("/:id", requirePremium, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await prisma.test.findFirst({
      where: { id, isPublished: true },
      include: {
        questions: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            marks: true
            // CRITICAL: DO NOT select correctOption or explanation here!
          }
        }
      }
    });
    if (!test) {
      res.status(404).json({ error: "Test paper not found or not published" });
      return;
    }
    res.json({ test });
  } catch (err) {
    console.error("Error fetching test paper:", err);
    res.status(500).json({ error: "Failed to load test paper" });
  }
});
router3.post("/:id/submit", requirePremium, async (req, res) => {
  try {
    const { id: testId } = req.params;
    const userId = req.user?.id;
    const { answers, timeTakenSec } = req.body;
    if (!userId) {
      res.status(401).json({ error: "User ID missing" });
      return;
    }
    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: "Invalid answers format" });
      return;
    }
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true }
    });
    if (!test) {
      res.status(404).json({ error: "Test paper not found" });
      return;
    }
    let totalScore = 0;
    test.questions.forEach((q) => {
      const studentAnswer = answers[q.id];
      if (studentAnswer && studentAnswer.toUpperCase() === q.correctOption.toUpperCase()) {
        totalScore += q.marks;
      }
    });
    const attempt = await prisma.attempt.create({
      data: {
        userId,
        testId,
        answers: JSON.stringify(answers),
        score: totalScore,
        totalMarks: test.totalMarks,
        timeTakenSec: Number(timeTakenSec) || 0,
        startedAt: new Date(Date.now() - (Number(timeTakenSec) || 0) * 1e3),
        submittedAt: /* @__PURE__ */ new Date()
      }
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const yesterdayStr = new Date(Date.now() - 864e5).toISOString().split("T")[0];
    let newCurrentStreak = user?.currentStreak || 0;
    const lastDay = user?.lastAttemptDay;
    if (lastDay === todayStr) {
      newCurrentStreak = Math.max(1, newCurrentStreak);
    } else if (lastDay === yesterdayStr) {
      newCurrentStreak += 1;
    } else {
      newCurrentStreak = 1;
    }
    const newLongestStreak = Math.max(user?.longestStreak || 0, newCurrentStreak);
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastAttemptDay: todayStr
      }
    });
    res.json({
      success: true,
      attemptId: attempt.id,
      score: totalScore,
      totalMarks: test.totalMarks,
      timeTakenSec: attempt.timeTakenSec,
      streak: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak
      }
    });
  } catch (err) {
    console.error("Error submitting test attempt:", err);
    res.status(500).json({ error: "Failed to submit test attempt" });
  }
});
router3.get("/attempts/:attemptId/result", requirePremium, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.id;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            questions: true
            // INCLUDES correctOption and explanation
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    if (!attempt) {
      res.status(404).json({ error: "Attempt record not found" });
      return;
    }
    if (attempt.userId !== userId && req.user?.role !== "ADMIN") {
      res.status(403).json({ error: "Access denied to this attempt result" });
      return;
    }
    const topperMax = await prisma.attempt.aggregate({
      where: { testId: attempt.testId },
      _max: { score: true }
    });
    const parsedAnswers = JSON.parse(attempt.answers || "{}");
    const questionsWithSolutions = attempt.test.questions.map((q) => {
      const studentAns = parsedAnswers[q.id] || null;
      const isCorrect = studentAns && studentAns.toUpperCase() === q.correctOption.toUpperCase();
      return {
        id: q.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        studentAnswer: studentAns,
        isCorrect,
        marks: q.marks,
        explanation: q.explanation
      };
    });
    res.json({
      attemptId: attempt.id,
      testTitle: attempt.test.title,
      subject: attempt.test.subject,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      timeTakenSec: attempt.timeTakenSec,
      submittedAt: attempt.submittedAt,
      topperScore: topperMax._max.score ?? attempt.score,
      questions: questionsWithSolutions,
      studentName: attempt.user.name
    });
  } catch (err) {
    console.error("Error fetching attempt result:", err);
    res.status(500).json({ error: "Failed to load attempt result details" });
  }
});
var testRoutes_default = router3;

// src/server/routes/adminRoutes.ts
import { Router as Router4 } from "express";

// src/server/gemini.ts
import { GoogleGenAI, Type } from "@google/genai";
var geminiClient = null;
function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
function heuristicFixQuestion(q, idx) {
  let statement = (q.questionText || "").trim();
  let optA = (q.optionA || "").trim();
  let optB = (q.optionB || "").trim();
  let optC = (q.optionC || "").trim();
  let optD = (q.optionD || "").trim();
  let correct = (q.correctOption || "A").toUpperCase().trim();
  let explanation = (q.explanation || "").trim();
  let marks = 1;
  if (typeof q.marks === "number" && q.marks > 0) {
    marks = Math.round(q.marks);
  } else if (typeof q.marks === "string") {
    const parsed = parseInt(q.marks.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) marks = parsed;
    else if (/two/i.test(q.marks)) marks = 2;
    else if (/three/i.test(q.marks)) marks = 3;
  }
  if (!statement) {
    if (optA && optB) {
      statement = `Evaluate and determine the correct value among the following given choices (${optA}, ${optB}):`;
    } else {
      statement = `Solve the standard RGUKT Mathematics entrance problem #${q.rowIndex || idx + 1}.`;
    }
  }
  if (!optA) optA = "True / Valid statement";
  if (!optB) optB = "False / Invalid statement";
  if (!optC) optC = optA !== "Both A and B" ? "Both A and B" : "Undefined";
  if (!optD) optD = optB !== "None of the above" ? "None of the above" : "Cannot be determined";
  if (optA === optB) optB = `${optB} (Alternative)`;
  if (optC === optA || optC === optB) optC = "Both A and B";
  if (optD === optA || optD === optB || optD === optC) optD = "None of the above";
  if (!["A", "B", "C", "D"].includes(correct)) {
    correct = "A";
  }
  if (!explanation) {
    const selectedText = correct === "A" ? optA : correct === "B" ? optB : correct === "C" ? optC : optD;
    explanation = `Correct choice is (${correct}): "${selectedText}" satisfies the problem definition.`;
  }
  return {
    rowIndex: q.rowIndex || idx + 1,
    id: q.id,
    questionText: statement,
    optionA: optA,
    optionB: optB,
    optionC: optC,
    optionD: optD,
    correctOption: correct,
    marks,
    explanation,
    aiNotes: "Fixed missing options and formatted marks using algorithmic validator.",
    isValid: true
  };
}
async function fixQuestionsWithGemini(questions, subject = "Mathematics") {
  if (!questions || questions.length === 0) {
    return [];
  }
  const ai = getGeminiClient();
  if (!ai) {
    console.warn("GEMINI_API_KEY not configured. Using intelligent heuristic repair fallback.");
    return questions.map((q, idx) => heuristicFixQuestion(q, idx));
  }
  try {
    const systemPrompt = `You are a high-level Senior Examination & Assessment Architect for the RGUKT CET (Rajiv Gandhi University of Knowledge Technologies Common Entrance Test - 10th / SSC standard ${subject}).

Your goal is to inspect a list of Multiple Choice Questions (MCQs) that currently have alerts, errors, missing options, missing question text, non-numeric marks, or missing explanations, and REPAIR each question completely into a flawless, high-quality, mathematically sound MCQ.

Rules for every repaired question:
1. "questionText": Must be a clear, self-contained, grammatically correct and mathematically rigorous question statement. Use LaTeX/MathJax for equations (e.g. $x^2 - 5x + 6 = 0$, $\\frac{a}{b}$, $\\sqrt{x}$). Never leave it empty.
2. "optionA", "optionB", "optionC", "optionD": Four distinct, plausible, clean options without prefixes like "A." or "(a)". If any option was missing or duplicate, generate realistic mathematical distractors appropriate for RGUKT entrance.
3. "correctOption": Must be strictly one of "A", "B", "C", or "D". Solve the question step-by-step to guarantee that this key is 100% mathematically correct!
4. "marks": An integer (typically 1, or 2 for multi-step problems).
5. "explanation": A clear, educational step-by-step mathematical derivation showing why the chosen correctOption is right and how it is computed.
6. "aiNotes": A concise 1-sentence explanation of what was fixed or enhanced by AI (e.g., "Reconstructed incomplete statement, generated distinct option C & D, solved correct answer key with proof.").`;
    const userContent = JSON.stringify(
      questions.map((q, i) => ({
        index: i,
        rowIndex: q.rowIndex || i + 1,
        questionText: q.questionText || "",
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctOption: q.correctOption || "",
        marks: q.marks,
        explanation: q.explanation || "",
        reportedIssues: q.issues || []
      }))
    );
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          text: `Fix the following ${questions.length} questions for subject "${subject}". Return all repaired items in a valid JSON array:

${userContent}`
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER, description: "Original index from request" },
              rowIndex: { type: Type.INTEGER, description: "Original row number" },
              questionText: { type: Type.STRING, description: "Repaired question statement" },
              optionA: { type: Type.STRING, description: "Option A choice text" },
              optionB: { type: Type.STRING, description: "Option B choice text" },
              optionC: { type: Type.STRING, description: "Option C choice text" },
              optionD: { type: Type.STRING, description: "Option D choice text" },
              correctOption: { type: Type.STRING, description: "Correct key: A, B, C, or D" },
              marks: { type: Type.INTEGER, description: "Marks integer (e.g. 1 or 2)" },
              explanation: { type: Type.STRING, description: "Mathematical step-by-step explanation" },
              aiNotes: { type: Type.STRING, description: "Summary of AI fixes applied" }
            },
            required: [
              "index",
              "questionText",
              "optionA",
              "optionB",
              "optionC",
              "optionD",
              "correctOption",
              "marks",
              "explanation"
            ]
          }
        }
      }
    });
    const textOutput = response.text ? response.text.trim() : "";
    if (!textOutput) {
      throw new Error("Empty response from Gemini AI");
    }
    const parsedArray = JSON.parse(textOutput);
    if (!Array.isArray(parsedArray)) {
      throw new Error("Gemini did not return an array of repaired questions");
    }
    const resultMap = /* @__PURE__ */ new Map();
    parsedArray.forEach((item) => {
      if (typeof item.index === "number") {
        resultMap.set(item.index, item);
      }
    });
    return questions.map((original, i) => {
      const fixed = resultMap.get(i);
      if (fixed) {
        let correctKey = (fixed.correctOption || "A").toUpperCase().trim();
        if (!["A", "B", "C", "D"].includes(correctKey)) {
          correctKey = "A";
        }
        return {
          rowIndex: original.rowIndex || fixed.rowIndex || i + 1,
          id: original.id,
          questionText: fixed.questionText || original.questionText || `Question ${i + 1}`,
          optionA: fixed.optionA || original.optionA || "Option A",
          optionB: fixed.optionB || original.optionB || "Option B",
          optionC: fixed.optionC || original.optionC || "Option C",
          optionD: fixed.optionD || original.optionD || "Option D",
          correctOption: correctKey,
          marks: Number(fixed.marks) > 0 ? Number(fixed.marks) : 1,
          explanation: fixed.explanation || original.explanation || "Mathematical solution verified by AI.",
          aiNotes: fixed.aiNotes || "Repaired and verified with Gemini AI.",
          isValid: true
        };
      }
      return heuristicFixQuestion(original, i);
    });
  } catch (err) {
    console.error("Error invoking Gemini AI to fix questions:", err);
    return questions.map((q, idx) => heuristicFixQuestion(q, idx));
  }
}

// src/server/services/subscriptionExpiryService.ts
var lastCheckResult = null;
async function checkAndExpireSubscriptions() {
  const now = /* @__PURE__ */ new Date();
  console.log(`[Subscription Expiry Service] Running daily 365-day expiration check at ${now.toISOString()}...`);
  const expiredUsers = [];
  let totalChecked = 0;
  let activeCount = 0;
  let expiredCount = 0;
  try {
    const premiumStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        isPremium: true
      }
    });
    for (const student of premiumStudents) {
      totalChecked++;
      const startDateRaw = student.premiumSince;
      if (!startDateRaw) {
        await revertStudentToFree(student.id, student.name, student.email, "Missing premium start date", 366);
        expiredUsers.push({
          id: student.id,
          name: student.name,
          email: student.email,
          elapsedDays: 366,
          premiumStartDate: "Unknown"
        });
        expiredCount++;
        continue;
      }
      const startDate = new Date(startDateRaw);
      const elapsedMs = now.getTime() - startDate.getTime();
      const elapsedDays = Math.floor(elapsedMs / (1e3 * 60 * 60 * 24));
      if (elapsedDays >= 365 || elapsedMs >= 365 * 24 * 60 * 60 * 1e3) {
        console.log(`[Subscription Expiry Service] Student "${student.name}" (${student.email}) subscription has elapsed ${elapsedDays} days (> 365 days). Reverting to Free.`);
        await revertStudentToFree(student.id, student.name, student.email, `Exceeded 365 days (${elapsedDays} days since activation)`, elapsedDays, startDate.toISOString());
        expiredUsers.push({
          id: student.id,
          name: student.name,
          email: student.email,
          elapsedDays,
          premiumStartDate: startDate.toISOString()
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
      expiredUsers
    };
    console.log(
      `[Subscription Expiry Service] Completed check: ${totalChecked} checked, ${activeCount} active, ${expiredCount} expired & reverted.`
    );
    return lastCheckResult;
  } catch (err) {
    console.error("[Subscription Expiry Service] Error during daily expiration check:", err);
    const failureResult = {
      success: false,
      timestamp: now.toISOString(),
      totalChecked,
      activeCount,
      expiredCount,
      expiredUsers
    };
    lastCheckResult = failureResult;
    return failureResult;
  }
}
async function revertStudentToFree(userId, userName, userEmail, reason, _elapsedDays, startDateStr) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isPremium: false
    }
  });
  try {
    await prisma.auditLog.create({
      data: {
        action: "AUTO_EXPIRE_PREMIUM_365_DAYS",
        details: `Automatic Daily Service reverted student "${userName}" (${userEmail}) to Free Tier. Reason: ${reason}. Active since: ${startDateStr || "N/A"}.`,
        adminName: "SYSTEM_SUBSCRIPTION_DAEMON"
      }
    });
  } catch (auditErr) {
    console.warn("[Subscription Expiry Service] Failed to create audit log:", auditErr);
  }
}
function getLastExpiryCheckStatus() {
  return lastCheckResult;
}

// src/server/routes/adminRoutes.ts
var router4 = Router4();
router4.use(authenticateToken);
router4.use(requireAdmin);
router4.get("/overview", async (req, res) => {
  try {
    const totalStudents = await prisma.user.count({
      where: { role: "STUDENT" }
    });
    const premiumStudents = await prisma.user.count({
      where: { role: "STUDENT", isPremium: true }
    });
    const totalTests = await prisma.test.count();
    const totalAttempts = await prisma.attempt.count();
    const revenueResult = await prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true }
    });
    const totalRevenuePaise = revenueResult._sum.amount || 0;
    const totalRevenueINR = Math.round(totalRevenuePaise / 100);
    const recentAttempts = await prisma.attempt.findMany({
      take: 5,
      orderBy: { submittedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        test: { select: { title: true } }
      }
    });
    res.json({
      totalStudents,
      premiumStudents,
      freeStudents: totalStudents - premiumStudents,
      totalTests,
      totalAttempts,
      totalRevenueINR,
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        studentName: a.user.name,
        studentEmail: a.user.email,
        testTitle: a.test.title,
        score: a.score,
        totalMarks: a.totalMarks,
        submittedAt: a.submittedAt
      }))
    });
  } catch (err) {
    console.error("Error fetching admin overview:", err);
    res.status(500).json({ error: "Failed to fetch admin overview stats" });
  }
});
router4.get("/tests", async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      include: {
        _count: { select: { questions: true, attempts: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        totalMarks: t.totalMarks,
        isPublished: t.isPublished,
        createdAt: t.createdAt,
        questionCount: t._count.questions,
        attemptCount: t._count.attempts
      }))
    });
  } catch (err) {
    console.error("Error fetching admin tests:", err);
    res.status(500).json({ error: "Failed to fetch test papers" });
  }
});
router4.get("/tests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true
      }
    });
    if (!test) {
      res.status(404).json({ error: "Test paper not found" });
      return;
    }
    res.json({ test });
  } catch (err) {
    console.error("Error fetching test detail:", err);
    res.status(500).json({ error: "Failed to fetch test detail" });
  }
});
router4.post("/tests", async (req, res) => {
  try {
    const { title, subject, durationMin, isPublished, questions } = req.body;
    if (!title || !subject || !durationMin || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: "Title, subject, duration, and at least 1 question are required" });
      return;
    }
    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
    const newTest = await prisma.test.create({
      data: {
        title: title.trim(),
        subject: subject.trim(),
        durationMin: Number(durationMin),
        totalMarks,
        isPublished: Boolean(isPublished),
        questions: {
          create: questions.map((q) => ({
            questionText: q.questionText.trim(),
            optionA: q.optionA.trim(),
            optionB: q.optionB.trim(),
            optionC: q.optionC.trim(),
            optionD: q.optionD.trim(),
            correctOption: q.correctOption.toUpperCase().trim(),
            marks: Number(q.marks) || 1,
            explanation: q.explanation ? q.explanation.trim() : null
          }))
        }
      },
      include: {
        questions: true
      }
    });
    res.status(201).json({ message: "Test paper created successfully", test: newTest });
  } catch (err) {
    console.error("Error creating test paper:", err);
    res.status(500).json({ error: "Failed to create test paper" });
  }
});
router4.put("/tests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, durationMin, isPublished, questions } = req.body;
    const existingTest = await prisma.test.findUnique({ where: { id } });
    if (!existingTest) {
      res.status(404).json({ error: "Test paper not found" });
      return;
    }
    const totalMarks = Array.isArray(questions) ? questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0) : existingTest.totalMarks;
    const updatedTest = await prisma.$transaction(async (tx) => {
      if (Array.isArray(questions)) {
        await tx.question.deleteMany({ where: { testId: id } });
      }
      return tx.test.update({
        where: { id },
        data: {
          title: title ? title.trim() : existingTest.title,
          subject: subject ? subject.trim() : existingTest.subject,
          durationMin: durationMin !== void 0 ? Number(durationMin) : existingTest.durationMin,
          isPublished: typeof isPublished === "boolean" ? isPublished : existingTest.isPublished,
          totalMarks,
          questions: Array.isArray(questions) ? {
            create: questions.map((q) => ({
              questionText: (q.questionText || "").trim(),
              optionA: (q.optionA || "").trim(),
              optionB: (q.optionB || "").trim(),
              optionC: (q.optionC || "").trim(),
              optionD: (q.optionD || "").trim(),
              correctOption: (q.correctOption || "A").toUpperCase().trim(),
              marks: Number(q.marks) || 1,
              explanation: q.explanation ? q.explanation.trim() : null
            }))
          } : void 0
        },
        include: {
          questions: true
        }
      });
    });
    res.json({ message: "Test paper updated successfully", test: updatedTest });
  } catch (err) {
    console.error("Error updating test paper:", err);
    res.status(500).json({ error: err?.message || "Failed to update test paper" });
  }
});
router4.delete("/tests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existingTest = await prisma.test.findUnique({ where: { id } });
    if (!existingTest) {
      res.status(404).json({ error: "Test paper not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.attempt.deleteMany({ where: { testId: id } });
      await tx.question.deleteMany({ where: { testId: id } });
      await tx.test.delete({ where: { id } });
    });
    res.json({ message: "Test paper deleted successfully" });
  } catch (err) {
    console.error("Error deleting test paper:", err);
    res.status(500).json({ error: err?.message || "Failed to delete test paper" });
  }
});
router4.get("/students", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        attempts: {
          select: { score: true, totalMarks: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    const formattedStudents = students.map((s) => {
      const attemptsCount = s.attempts.length;
      const totalScore = s.attempts.reduce((sum, a) => sum + a.score, 0);
      const possibleMarks = s.attempts.reduce((sum, a) => sum + a.totalMarks, 0);
      const avgPercentage = possibleMarks > 0 ? Math.round(totalScore / possibleMarks * 100) : 0;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        isPremium: s.isPremium,
        premiumSince: s.premiumSince,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        createdAt: s.createdAt,
        attemptsCount,
        avgPercentage
      };
    });
    res.json({ students: formattedStudents });
  } catch (err) {
    console.error("Error fetching students list:", err);
    res.status(500).json({ error: "Failed to fetch students list" });
  }
});
router4.get("/students/:id/performance", async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isPremium: true,
        premiumSince: true,
        currentStreak: true,
        longestStreak: true,
        lastAttemptDay: true,
        createdAt: true
      }
    });
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const attempts = await prisma.attempt.findMany({
      where: { userId: id },
      include: {
        test: { select: { id: true, title: true, subject: true, totalMarks: true } }
      },
      orderBy: { submittedAt: "desc" }
    });
    const performanceHistory = await Promise.all(
      attempts.map(async (a) => {
        const topperMax = await prisma.attempt.aggregate({
          where: { testId: a.testId },
          _max: { score: true }
        });
        const topperScore = topperMax._max.score ?? a.score;
        const percentage = Math.round(a.score / a.totalMarks * 100);
        return {
          id: a.id,
          testId: a.testId,
          testTitle: a.test.title,
          subject: a.test.subject,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage,
          timeTakenSec: a.timeTakenSec,
          submittedAt: a.submittedAt,
          topperScore,
          gapToTopper: topperScore - a.score
        };
      })
    );
    const totalAttemptsCount = performanceHistory.length;
    const avgScorePercentage = totalAttemptsCount > 0 ? Math.round(
      performanceHistory.reduce((acc, curr) => acc + curr.percentage, 0) / totalAttemptsCount
    ) : 0;
    const subjectMap = {};
    performanceHistory.forEach((a) => {
      const subj = a.subject || "General Studies";
      if (!subjectMap[subj]) {
        subjectMap[subj] = { subject: subj, attemptCount: 0, percentages: [], totalScore: 0, totalMarks: 0 };
      }
      subjectMap[subj].attemptCount += 1;
      subjectMap[subj].percentages.push(a.percentage);
      subjectMap[subj].totalScore += a.score;
      subjectMap[subj].totalMarks += a.totalMarks;
    });
    const subjectBreakdown = Object.values(subjectMap).map((item) => ({
      subject: item.subject,
      attemptCount: item.attemptCount,
      avgPercentage: Math.round(item.percentages.reduce((s, p) => s + p, 0) / item.attemptCount),
      highestPercentage: Math.max(...item.percentages),
      totalScore: item.totalScore,
      totalMarks: item.totalMarks
    }));
    const totalTimeSpentSec = performanceHistory.reduce((sum, a) => sum + (a.timeTakenSec || 0), 0);
    const totalMarksSum = performanceHistory.reduce((sum, a) => sum + a.totalMarks, 0);
    const analytics = {
      totalExamsWritten: totalAttemptsCount,
      avgPercentage: avgScorePercentage,
      highestPercentage: totalAttemptsCount > 0 ? Math.max(...performanceHistory.map((a) => a.percentage)) : 0,
      totalTimeSpentSec,
      avgTimePerQuestionSec: totalMarksSum > 0 ? Math.round(totalTimeSpentSec / totalMarksSum) : 0,
      strongSubjects: subjectBreakdown.filter((s) => s.avgPercentage >= 70).map((s) => s.subject),
      weakSubjects: subjectBreakdown.filter((s) => s.avgPercentage < 50).map((s) => s.subject),
      accuracyRating: avgScorePercentage >= 80 ? "Excellent" : avgScorePercentage >= 65 ? "Good" : avgScorePercentage >= 50 ? "Average" : "Needs Improvement",
      subjectBreakdown
    };
    res.json({
      student,
      performanceHistory,
      analytics
    });
  } catch (err) {
    console.error("Error fetching student performance:", err);
    res.status(500).json({ error: "Failed to fetch student performance details" });
  }
});
router4.post(["/students/:id/grant-premium", "/students/:id/grant-permission"], async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.user.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        isPremium: true,
        premiumSince: /* @__PURE__ */ new Date()
      }
    });
    await prisma.auditLog.create({
      data: {
        action: "ADMIN_GRANT_PREMIUM",
        details: `Administrator granted full 365-day premium membership permission to student "${updatedStudent.name}" (${updatedStudent.email}).`
      }
    });
    const subscription = evaluateSubscription(updatedStudent);
    res.json({
      message: `Premium permission successfully granted to ${updatedStudent.name}. Account is now Premium Active.`,
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        isPremium: updatedStudent.isPremium,
        premiumSince: updatedStudent.premiumSince,
        subscription
      }
    });
  } catch (err) {
    console.error("Error granting premium status:", err);
    res.status(500).json({ error: "Failed to grant premium status" });
  }
});
router4.post("/students/:id/revoke-premium", async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.user.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const updatedStudent = await prisma.user.update({
      where: { id },
      data: {
        isPremium: false,
        premiumSince: null
      }
    });
    await prisma.auditLog.create({
      data: {
        action: "ADMIN_REVOKE_PREMIUM",
        details: `Administrator revoked premium status for student "${updatedStudent.name}" (${updatedStudent.email}). Account reverted to Free Tier.`
      }
    });
    const subscription = evaluateSubscription(updatedStudent);
    res.json({
      message: `Premium permission revoked for ${updatedStudent.name}. Account reverted to Free Tier.`,
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        isPremium: updatedStudent.isPremium,
        premiumSince: updatedStudent.premiumSince,
        subscription
      }
    });
  } catch (err) {
    console.error("Error revoking premium status:", err);
    res.status(500).json({ error: "Failed to revoke premium status" });
  }
});
router4.get("/tests/:id/analytics", async (req, res) => {
  try {
    const { id } = req.params;
    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: true
      }
    });
    if (!test) {
      res.status(404).json({ error: "Test paper not found" });
      return;
    }
    const attempts = await prisma.attempt.findMany({
      where: { testId: id },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: [{ score: "desc" }, { timeTakenSec: "asc" }]
    });
    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / totalAttempts * 10) / 10 : 0;
    const avgTimeSec = totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.timeTakenSec, 0) / totalAttempts) : 0;
    const topperAttempt = attempts[0] || null;
    const scoreBuckets = {
      "0-20%": 0,
      "21-40%": 0,
      "41-60%": 0,
      "61-80%": 0,
      "81-100%": 0
    };
    attempts.forEach((a) => {
      const pct = a.score / a.totalMarks * 100;
      if (pct <= 20) scoreBuckets["0-20%"]++;
      else if (pct <= 40) scoreBuckets["21-40%"]++;
      else if (pct <= 60) scoreBuckets["41-60%"]++;
      else if (pct <= 80) scoreBuckets["61-80%"]++;
      else scoreBuckets["81-100%"]++;
    });
    const leaderboard = attempts.slice(0, 10).map((a, rank) => ({
      rank: rank + 1,
      studentName: a.user.name,
      studentEmail: a.user.email,
      score: a.score,
      totalMarks: a.totalMarks,
      percentage: Math.round(a.score / a.totalMarks * 100),
      timeTakenSec: a.timeTakenSec,
      submittedAt: a.submittedAt
    }));
    res.json({
      test: {
        id: test.id,
        title: test.title,
        subject: test.subject,
        durationMin: test.durationMin,
        totalMarks: test.totalMarks,
        isPublished: test.isPublished
      },
      analytics: {
        totalAttempts,
        avgScore,
        avgTimeSec,
        scoreBuckets,
        topper: topperAttempt ? {
          name: topperAttempt.user.name,
          email: topperAttempt.user.email,
          score: topperAttempt.score,
          percentage: Math.round(topperAttempt.score / test.totalMarks * 100),
          timeTakenSec: topperAttempt.timeTakenSec
        } : null
      },
      leaderboard,
      questions: test.questions
    });
  } catch (err) {
    console.error("Error fetching test analytics:", err);
    res.status(500).json({ error: "Failed to fetch test analytics" });
  }
});
router4.get("/batches", async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ batches });
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
});
router4.post("/batches", async (req, res) => {
  try {
    const { name, code, stream, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: "Name and Code are required" });
      return;
    }
    const batch = await prisma.batch.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        stream: (stream || "RGUKT CET").trim(),
        description: description ? description.trim() : null
      }
    });
    res.status(201).json({ message: "Batch created successfully", batch });
  } catch (err) {
    console.error("Error creating batch:", err);
    res.status(500).json({ error: "Failed to create batch" });
  }
});
router4.delete("/batches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.batch.delete({ where: { id } });
    res.json({ message: "Batch deleted successfully" });
  } catch (err) {
    console.error("Error deleting batch:", err);
    res.status(500).json({ error: "Failed to delete batch" });
  }
});
router4.get("/announcements", async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }]
    });
    res.json({ announcements });
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});
router4.post("/announcements", async (req, res) => {
  try {
    const { title, content, priority, isPinned, targetBatch } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: "Title and content are required" });
      return;
    }
    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        priority: priority || "NORMAL",
        isPinned: Boolean(isPinned),
        targetBatch: targetBatch || "ALL"
      }
    });
    res.status(201).json({ message: "Announcement created successfully", announcement });
  } catch (err) {
    console.error("Error creating announcement:", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});
router4.delete("/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id } });
    res.json({ message: "Announcement deleted successfully" });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});
router4.get("/audit-logs", async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" }
    });
    res.json({ logs });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});
router4.get("/question-bank", async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        test: { select: { title: true, subject: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ questions });
  } catch (err) {
    console.error("Error fetching question bank:", err);
    res.status(500).json({ error: "Failed to fetch question bank" });
  }
});
router4.get("/attempts", async (req, res) => {
  try {
    const attempts = await prisma.attempt.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        test: { select: { id: true, title: true, subject: true, totalMarks: true } }
      },
      orderBy: { submittedAt: "desc" }
    });
    res.json({ attempts });
  } catch (err) {
    console.error("Error fetching all attempts:", err);
    res.status(500).json({ error: "Failed to fetch attempts list" });
  }
});
router4.get("/payments", async (req, res) => {
  try {
    const { status, search } = req.query;
    const whereClause = {};
    if (status && typeof status === "string" && status !== "ALL") {
      whereClause.status = status;
    }
    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { razorpayOrderId: { contains: term } },
        { razorpayPaymentId: { contains: term } },
        { user: { name: { contains: term } } },
        { user: { email: { contains: term } } }
      ];
    }
    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, isPremium: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const revenueAggregate = await prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true }
    });
    const totalRevenueINR = Math.round((revenueAggregate._sum.amount || 0) / 100);
    res.json({ payments, totalRevenueINR });
  } catch (err) {
    console.error("Error fetching admin payments:", err);
    res.status(500).json({ error: "Failed to fetch payments records" });
  }
});
router4.post("/payments/manual", async (req, res) => {
  try {
    const { studentEmail, amountINR = 3e3, notes } = req.body;
    if (!studentEmail) {
      res.status(400).json({ error: "Student email is required" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { email: studentEmail.trim().toLowerCase() }
    });
    if (!user) {
      res.status(404).json({ error: `Student with email "${studentEmail}" not found` });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isPremium: true, premiumSince: /* @__PURE__ */ new Date() }
    });
    const orderId = `manual_off_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const paymentId = `pay_off_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const amountPaise = (amountINR || 3e3) * 100;
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amount: amountPaise,
        status: "PAID"
      },
      include: {
        user: { select: { id: true, name: true, email: true, isPremium: true } }
      }
    });
    await prisma.auditLog.create({
      data: {
        action: "MANUAL_PAYMENT_APPROVAL",
        details: `Approved manual payment of \u20B9${amountINR} for ${user.email}. ${notes || ""}`
      }
    });
    res.json({ message: `Manual payment recorded and premium activated for ${user.name}`, payment });
  } catch (err) {
    console.error("Error processing manual payment:", err);
    res.status(500).json({ error: "Failed to process manual payment" });
  }
});
router4.post("/payments/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!payment) {
      res.status(404).json({ error: "Payment record not found" });
      return;
    }
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { status: "PAID", razorpayPaymentId: payment.razorpayPaymentId || `pay_manual_${Date.now()}` }
    });
    await prisma.user.update({
      where: { id: payment.userId },
      data: { isPremium: true, premiumSince: /* @__PURE__ */ new Date() }
    });
    res.json({ message: "Payment approved and premium membership activated", payment: updatedPayment });
  } catch (err) {
    console.error("Error approving payment:", err);
    res.status(500).json({ error: "Failed to approve payment" });
  }
});
router4.post("/fix-questions-ai", async (req, res) => {
  try {
    const { questions, subject } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: "Array of questions is required" });
      return;
    }
    console.log(`[AI Question Fixer] Processing ${questions.length} questions for subject: ${subject || "Mathematics"}`);
    const fixedQuestions = await fixQuestionsWithGemini(questions, subject);
    res.json({
      success: true,
      count: fixedQuestions.length,
      fixedQuestions,
      message: `Successfully analyzed and repaired ${fixedQuestions.length} question(s) with AI.`
    });
  } catch (err) {
    console.error("Error fixing questions with AI:", err);
    res.status(500).json({ error: err.message || "Failed to fix questions using AI" });
  }
});
router4.get("/subscriptions/daily-check-status", async (_req, res) => {
  try {
    const status = getLastExpiryCheckStatus();
    res.json({ status: status || { message: "Daily daemon active. Initial check pending." } });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve daily check status" });
  }
});
router4.post("/subscriptions/run-daily-check", async (_req, res) => {
  try {
    const result = await checkAndExpireSubscriptions();
    res.json({
      message: `Checked ${result.totalChecked} students: ${result.activeCount} active, ${result.expiredCount} expired after 365 days.`,
      result
    });
  } catch (err) {
    console.error("Manual subscription check error:", err);
    res.status(500).json({ error: "Failed to execute 365-day subscription expiration check" });
  }
});
var adminRoutes_default = router4;

// src/server/app.ts
var app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "10mb" }));
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get(["/api/health/db", "/health/db"], async (_req, res) => {
  try {
    const health = await checkDatabaseHealth();
    if (health.ok) {
      res.json({
        status: "ok",
        database: "connected",
        provider: health.provider,
        time: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        time: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (err) {
    console.error("Health check exception:", err?.message || err);
    res.status(503).json({
      status: "error",
      database: "disconnected",
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.use("/api/auth", authRoutes_default);
app.use("/auth", authRoutes_default);
app.use("/api/payment", paymentRoutes_default);
app.use("/payment", paymentRoutes_default);
app.use("/api/tests", testRoutes_default);
app.use("/tests", testRoutes_default);
app.use("/api/admin", adminRoutes_default);
app.use("/admin", adminRoutes_default);
app.all(["/api", "/api/*", "/auth/*", "/payment/*", "/tests/*", "/admin/*"], (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled API Server Error:", err);
  if (isDatabaseError(err)) {
    res.status(503).json({
      error: "Database temporarily unavailable"
    });
    return;
  }
  res.status(err?.status || 500).json({
    error: err?.message || "Internal Server Error during request processing"
  });
});
var app_default = app;
export {
  app,
  app_default as default
};
