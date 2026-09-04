import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { execSync } from 'child_process';

const localDevDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = `file:${localDevDbPath}?connection_limit=1`;
}

import { prisma } from './src/server/db';
import { app } from './src/server/app';
import { startDailySubscriptionExpiryCron } from './src/server/services/subscriptionExpiryService';

const PORT = 3000;

async function bootstrapDatabase() {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const dbUrl = (process.env.DATABASE_URL || '').trim();

  try {
    console.log('Ensuring database schema is synchronized...');
    
    if (isProd || dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
      // Production PostgreSQL: use safe migrations, NEVER db push --accept-data-loss
      try {
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        });
      } catch (migErr: any) {
        console.warn('Notice: Migration deploy status:', migErr?.message || migErr);
      }
    } else {
      // Local development with SQLite: safe sync
      execSync('npx prisma db push', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
    }

    // Check if admin user exists, if not run seed
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('Database empty, running initial seed script...');
      execSync('npx tsx prisma/seed.ts', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
    }
  } catch (err: any) {
    console.error('Database bootstrap notice:', err?.message || err);
  }
}

async function startServer() {
  await bootstrapDatabase();

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Production build not found. Please run `npm run build` before starting in production mode.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RGUKT TestPrep Platform server running on http://localhost:${PORT}`);
    startDailySubscriptionExpiryCron();
  });
}

startServer();
