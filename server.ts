import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app';
import { startDailySubscriptionExpiryCron } from './src/server/services/subscriptionExpiryService';

const PORT = 3000;

async function startServer() {
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
