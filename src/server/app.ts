import express from 'express';
import authRoutes from './routes/authRoutes';
import paymentRoutes from './routes/paymentRoutes';
import testRoutes from './routes/testRoutes';
import adminRoutes from './routes/adminRoutes';
import { checkDatabaseHealth } from './db';
import { isDatabaseError } from './utils/dbErrorHandler';

export const app = express();

// CORS & Security Headers Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Health Check Endpoints
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// Safe database health check endpoint that verifies DB connectivity without leaking credentials or secrets
app.get(['/api/health/db', '/health/db'], async (_req, res) => {
  try {
    const health = await checkDatabaseHealth();
    if (health.ok) {
      res.json({
        status: 'ok',
        database: 'connected',
        provider: health.provider,
        time: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        time: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.error('Health check exception:', err?.message || err);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      time: new Date().toISOString(),
    });
  }
});

// Mount API Routes for both /api/* and root /* (for Vercel serverless prefix tolerance)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/payment', paymentRoutes);
app.use('/payment', paymentRoutes);

app.use('/api/tests', testRoutes);
app.use('/tests', testRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

// Catch-all 404 for unmatched API requests (guarantees JSON instead of HTML fallback)
app.all(['/api', '/api/*', '/auth/*', '/payment/*', '/tests/*', '/admin/*'], (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Express Global API Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API Server Error:', err);
  if (isDatabaseError(err)) {
    res.status(503).json({
      error: 'Database temporarily unavailable',
    });
    return;
  }
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal Server Error during request processing',
  });
});

export default app;

