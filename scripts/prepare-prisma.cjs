const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.log('[prepare-prisma] No schema.prisma found, skipping.');
  process.exit(0);
}

const dbUrl = (process.env.DATABASE_URL || '').trim();
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

// Detect target provider based on DATABASE_URL protocol:
// If DATABASE_URL starts with postgres/postgresql -> postgresql
// Otherwise (local development or SQLite file URL) -> sqlite
let targetProvider = 'sqlite';
if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
  targetProvider = 'postgresql';
}

console.log(`[prepare-prisma] Target database provider: ${targetProvider} (DATABASE_URL configured: ${Boolean(dbUrl)})`);

let schema = fs.readFileSync(schemaPath, 'utf8');
const providerRegex = /provider\s*=\s*"(sqlite|postgresql)"/;

if (providerRegex.test(schema)) {
  const currentProviderMatch = schema.match(providerRegex);
  const currentProvider = currentProviderMatch ? currentProviderMatch[1] : '';
  
  if (currentProvider !== targetProvider) {
    console.log(`[prepare-prisma] Updating schema provider from "${currentProvider}" to "${targetProvider}"`);
    schema = schema.replace(providerRegex, `provider = "${targetProvider}"`);
    fs.writeFileSync(schemaPath, schema, 'utf8');
  }
}

try {
  console.log('[prepare-prisma] Generating Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
} catch (err) {
  console.error('[prepare-prisma] Error generating Prisma client:', err.message);
  process.exit(1);
}
