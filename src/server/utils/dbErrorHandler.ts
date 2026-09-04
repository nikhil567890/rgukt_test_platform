import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Checks if an error is an internal database or Prisma exception.
 */
export function isDatabaseError(err: any): boolean {
  if (!err) return false;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return true;
  if (err instanceof Prisma.PrismaClientUnknownRequestError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientValidationError) return true;
  if (typeof err.code === 'string' && (err.code.startsWith('P') || err.code.startsWith('42') || err.code === 'ECONNREFUSED')) {
    return true;
  }
  if (typeof err.name === 'string' && err.name.includes('Prisma')) return true;
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('table') ||
    msg.includes('relation') ||
    msg.includes('database') ||
    msg.includes('prisma') ||
    msg.includes('connection refused') ||
    msg.includes('p2021')
  ) {
    return true;
  }
  return false;
}

function sanitizeErrorString(val: any): any {
  if (typeof val === 'string') {
    return val.replace(/postgres(ql)?:\/\/[^@\s]+@/gi, 'postgres://***:***@');
  }
  return val;
}

/**
 * Logs full diagnostic information to the server log while returning a safe,
 * unexposed message to the client. Never leaks DATABASE_URL, table names,
 * or raw query internals to the frontend.
 */
export function handleDatabaseError(
  err: any,
  res: Response,
  fallbackMessage: string = 'Internal server error'
): void {
  const isDb = isDatabaseError(err);

  // Diagnostic log for server operators / Vercel log stream (with URI/credential sanitization)
  console.error('[DATABASE DIAGNOSTIC LOG]:', {
    name: err?.name,
    code: err?.code,
    message: sanitizeErrorString(err?.message),
    isDatabaseError: isDb,
  });

  if (isDb) {
    res.status(503).json({
      error: 'Database temporarily unavailable',
    });
    return;
  }

  res.status(500).json({
    error: fallbackMessage,
  });
}
