// apps/api/src/routes/health.ts
import { Hono } from 'hono';
import { SQL } from 'bun';
import { metrics } from '../middleware/observability';
import { RedisSessionStore } from '@mia-crm/module-identity';

export function createHealthRouter(options?: { sql?: SQL; sessionStore?: RedisSessionStore }) {
  const router = new Hono();
  const sql =
    options?.sql ??
    new SQL(
      process.env.APP_DATABASE_URL ||
        'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev',
    );
  const sessionStore = options?.sessionStore ?? new RedisSessionStore();

  // 1. Liveness Probe (Kubernetes / ECS / Docker)
  router.get('/', (c) => {
    return c.json({
      status: 'ok',
      service: 'mia-crm-api',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Deep Readiness Probe (Verifica PostgreSQL, Redis y RabbitMQ)
  router.get('/ready', async (c) => {
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }> =
      {};
    let isHealthy = true;

    // A. Check PostgreSQL
    const pgStart = performance.now();
    try {
      const rows = await sql<{ ok: number }[]>`SELECT 1 as ok`;
      if (rows && rows[0]?.ok === 1) {
        checks.postgres = {
          status: 'up',
          latencyMs: Math.round(performance.now() - pgStart),
        };
      } else {
        throw new Error('Respuesta inesperada de PostgreSQL');
      }
    } catch (err: any) {
      isHealthy = false;
      checks.postgres = {
        status: 'down',
        error: err.message,
      };
    }

    // B. Check Redis
    const redisStart = performance.now();
    try {
      // El session store valida conectividad interna al llamar operaciones de sesión
      const testKey = `healthcheck:${crypto.randomUUID()}`;
      await sessionStore.createSession({
        userId: 'healthcheck',
        tenantId: '00000000-0000-0000-0000-000000000000',
        role: 'system',
      });
      checks.redis = {
        status: 'up',
        latencyMs: Math.round(performance.now() - redisStart),
      };
    } catch (err: any) {
      // Si redis falla o no está disponible en este momento
      checks.redis = {
        status: 'down',
        error: err.message,
      };
    }

    // C. Check RabbitMQ TCP port (5672)
    try {
      const rabbitHost = process.env.RABBITMQ_HOST || 'localhost';
      const rabbitPort = Number(process.env.RABBITMQ_PORT || 5672);
      const socket = await Bun.connect({
        hostname: rabbitHost,
        port: rabbitPort,
        socket: {
          data() {},
          open(s) {
            s.end();
          },
          error() {},
        },
      });
      checks.rabbitmq = { status: 'up' };
      socket.end();
    } catch (err: any) {
      checks.rabbitmq = { status: 'down', error: err.message };
    }

    const httpStatus = isHealthy ? 200 : 503;
    return c.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      },
      httpStatus,
    );
  });

  // Alias /health/deep
  router.get('/deep', (c) => c.redirect('/health/ready'));

  return router;
}

export function createMetricsRouter() {
  const router = new Hono();

  // GET /metrics — Formato Prometheus / OpenMetrics estándar
  router.get('/', (c) => {
    const output = metrics.toPrometheusFormat();
    return c.text(output, 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });

  // GET /metrics/summary — Formato JSON amigable para dashboards de administración
  router.get('/summary', (c) => {
    return c.json({
      data: metrics.getSummary(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
