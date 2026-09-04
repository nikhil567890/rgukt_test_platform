const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.log('[prepare-prisma] No schema.prisma found, skipping.');
  process.exit(0);
}

// Remove any stale Prisma 5 artifacts from node_modules/.prisma
const stalePrismaDir = path.resolve(__dirname, '..', 'node_modules', '.prisma');
if (fs.existsSync(stalePrismaDir)) {
  try {
    fs.rmSync(stalePrismaDir, { recursive: true, force: true });
    console.log('[prepare-prisma] Cleaned up legacy .prisma client artifacts.');
  } catch (cleanErr) {
    console.warn('[prepare-prisma] Notice removing legacy .prisma:', cleanErr.message);
  }
}

// Ensure the datasource provider is ALWAYS postgresql
let schema = fs.readFileSync(schemaPath, 'utf8');
const providerRegex = /provider\s*=\s*"sqlite"/;
if (providerRegex.test(schema)) {
  console.log('[prepare-prisma] Correcting provider from sqlite to postgresql in schema.prisma...');
  schema = schema.replace(providerRegex, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema, 'utf8');
}

try {
  console.log('[prepare-prisma] Generating Prisma Client (v7.10.0) with postgresql provider...');
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
} catch (err) {
  console.error('[prepare-prisma] Error generating Prisma client:', err.message);
  process.exit(1);
}

// Deploy migrations safely during build if DATABASE_URL is configured for PostgreSQL
const dbUrl = (process.env.DATABASE_URL || '').trim();
if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
  try {
    console.log('[prepare-prisma] Applying production database migrations safely (prisma migrate deploy)...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
    console.log('[prepare-prisma] Database migrations deployed successfully.');
  } catch (migErr) {
    console.error('[prepare-prisma] Warning: Migration deploy during build phase failed:', migErr.message);
    // Do not abort build so deployment bundle can still be generated if DB is reachable only at runtime
  }
} else {
  console.log('[prepare-prisma] Notice: DATABASE_URL is not set to a PostgreSQL connection string during this build phase.');
}
