import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, {
  Application,
  Request,
  Response,
  json,
  urlencoded,
} from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYAML } from 'yaml';

import corsConfiguration from '@/app/configs/cors.configs';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { traceMiddleware } from '@/app/middlewares/trace.middlewares';
import { baseUrl } from '@/const';
import { globalErrorMiddleware } from '@/app/middlewares/globalError.middlewares';
import {
  morganMessageFormat,
  streamConfig,
} from '@/app/configs/morgan.configs';
import v1Routes from '@/app/routes/v1';
import prisma from '@/app/configs/db.configs';
import { getRedisClient } from '@/app/configs/redis.configs';
const app: Application = express();

app.use(traceMiddleware);
app.use((req, res, next) => {
  if (
    req.originalUrl.includes('/webhooks/payment/stripe') ||
    req.originalUrl.includes('/webhooks/stripe') ||
    req.path === '/api/v1/connect/webhook'
  ) {
    next(); // skip json() — raw() in the route handles it
  } else {
    json()(req, res, next);
  }
});
app.use(urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(cors(corsConfiguration));
app.use(
  morgan(morganMessageFormat, {
    stream: {
      write: (message: string) => streamConfig(message),
    },
  })
);
app.use(helmet());

app.get('/health', async (_req: Request, res: Response) => {
  const traceId = getTraceId();
  const timeoutMs = 3000;

  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        )
      ),
    ]);
  };

  const status = {
    database: 'down',
    redis: 'down',
  };

  let isHealthy = true;

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs, 'Database');
    status.database = 'up';
  } catch (error) {
    console.error(`[HealthCheck] Database error:`, error);
    isHealthy = false;
  }

  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      const pingResult = await withTimeout(
        redisClient.ping(),
        timeoutMs,
        'Redis'
      );
      if (pingResult === 'PONG') {
        status.redis = 'up';
      } else {
        console.error(
          `[HealthCheck] Redis returned unexpected ping result:`,
          pingResult
        );
        isHealthy = false;
      }
    } else {
      console.error(`[HealthCheck] Redis client not initialized`);
      isHealthy = false;
    }
  } catch (error) {
    console.error(`[HealthCheck] Redis error:`, error);
    isHealthy = false;
  }

  if (isHealthy) {
    res.status(200).json({
      status: 'ok',
      success: true,
      message: 'Server Is Running',
      dependencies: status,
      traceId,
    });
  } else {
    res.status(503).json({
      status: 'degraded',
      success: false,
      message: 'Service is degraded',
      dependencies: status,
      traceId,
    });
  }
  return;
});

/* ====================================|
|--------------APP ROUTES--------------|
|==================================== */

let currentDir = __dirname;
let yamlPath = path.join(currentDir, 'openapi.yaml');

while (!fs.existsSync(yamlPath) && currentDir !== path.parse(currentDir).root) {
  currentDir = path.dirname(currentDir);
  yamlPath = path.join(currentDir, 'openapi.yaml');
}

if (!fs.existsSync(yamlPath)) {
  throw new Error(
    'Failed to locate openapi.yaml for Swagger UI. Ensure it is copied to the runtime environment.'
  );
}

const swaggerDocument = parseYAML(fs.readFileSync(yamlPath, 'utf-8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// V1 ROUTES
app.use(baseUrl.v1, v1Routes);

// Flutter App Link fallback — in production this URL is intercepted by the native OS
// before the browser renders it. This HTML page is only visible in a plain browser
// (e.g. during dev/testing) where the Flutter App Link is not registered.
app.get('/connect/complete', (_req: Request, res: Response) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Allround — Return to App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f13;
      color: #f0f0f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a1a24;
      border: 1px solid #2a2a3a;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      max-width: 380px;
      width: 100%;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    p { font-size: 15px; line-height: 1.6; color: #9090aa; margin-bottom: 24px; }
    .note {
      font-size: 12px;
      color: #5a5a70;
      background: #111118;
      border-radius: 8px;
      padding: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Setup Complete</h1>
    <p>Your payout account has been processed.<br/>Please return to the <strong>Allround</strong> app to continue.</p>
    <div class="note">If you are on a mobile device with the app installed, it should have opened automatically.</div>
  </div>
</body>
</html>`);
});



app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.use(globalErrorMiddleware);

export default app;
