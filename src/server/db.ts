import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// Validate and configure DATABASE_URL:
// - In production: DATABASE_URL must be explicitly provided (persistent PostgreSQL database)
// - In development: Fall back to local persistent SQLite file in prisma/dev.db
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  if (isProduction) {
    throw new Error(
      'CRITICAL DATABASE CONFIGURATION ERROR: DATABASE_URL environment variable is missing in production. Ephemeral /tmp or unconfigured databases are disabled in production. You must configure a persistent PostgreSQL DATABASE_URL (e.g. Supabase, Neon, AWS RDS) in your Vercel Project Settings.'
    );
  }
  // Local development fallback only
  const devDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  process.env.DATABASE_URL = `file:${devDbPath}?connection_limit=1`;
} else if (isProduction && (process.env.DATABASE_URL.startsWith('file:') || process.env.DATABASE_URL.includes('/tmp/'))) {
  throw new Error(
    'CRITICAL DATABASE CONFIGURATION ERROR: Ephemeral SQLite file database is not allowed in production serverless environments. Please configure a persistent PostgreSQL DATABASE_URL in your Vercel Project Settings.'
  );
}

const dbUrl = process.env.DATABASE_URL!;

interface GlobalDbState {
  prisma?: PrismaClient;
}

const globalForDb = globalThis as unknown as GlobalDbState;

function createPrismaClient(): PrismaClient {
  if (globalForDb.prisma) {
    return globalForDb.prisma;
  }

  let adapter: any;
  if (dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:')) {
    adapter = new PrismaPg({ connectionString: dbUrl });
  } else {
    const sqliteFilePath = dbUrl.replace(/^file:/, '').split('?')[0];
    adapter = new PrismaBetterSqlite3({ url: sqliteFilePath });
  }

  const client = new PrismaClient({ adapter });

  // Enable WAL mode and busy timeout only when running local SQLite database
  if (dbUrl.startsWith('file:')) {
    client.$executeRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
    client.$executeRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
  }

  globalForDb.prisma = client;
  return client;
}

export const prisma: PrismaClient = createPrismaClient();

/**
 * Diagnostic database health checker that safely tests database connectivity
 * WITHOUT exposing connection strings, credentials, or internal details.
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; provider: string }> {
  const provider = dbUrl.startsWith('postgres') ? 'postgresql' : 'sqlite';
  try {
    await prisma.$queryRawUnsafe('SELECT 1 as connected');
    return { ok: true, provider };
  } catch (err: any) {
    console.error('[Database Health Check Failed]:', err?.message || err);
    return { ok: false, provider };
  }
}
