import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuthRouter } from './routes/auth';
import { createIngestRouter } from './routes/ingest';
import { createVehiclesRouter } from './routes/vehicles';
import { createOpportunitiesRouter } from './routes/opportunities';
import { createCommercialRouter } from './routes/commercial';
import { createMetricsRouter as createSemanticMetricsRouter } from './routes/metrics';
import { createAiRouter } from './routes/ai';
import { createHealthRouter, createMetricsRouter as createPrometheusMetricsRouter } from './routes/health';
import { observabilityMiddleware } from './middleware/observability';
import { securityHeadersMiddleware } from './middleware/security';

export function createServer() {
  const app = new Hono();

  // 1. Cabeceras de seguridad y observabilidad global
  app.use('*', securityHeadersMiddleware);
  app.use('*', observabilityMiddleware);
  app.use('*', cors());

  // 2. Healthchecks y sondas de disponibilidad (Liveness y Readiness profundos)
  app.route('/health', createHealthRouter());

  // 3. Métricas del sistema en formato Prometheus / OpenMetrics
  app.route('/metrics', createPrometheusMetricsRouter());

  // 4. Prefijo de rutas API v1
  const v1 = new Hono();

  v1.get('/status', (c) => {
    return c.json({
      message: 'MIA CRM Automotive API v1 operativa',
      modules: [
        'identity',
        'audit',
        'aftersales',
        'vehicle',
        'opportunity',
        'commercial',
        'metrics',
        'ai',
        'observability',
      ],
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0-pilot',
    });
  });

  v1.route('/auth', createAuthRouter());
  v1.route('/ingest', createIngestRouter());
  v1.route('/vehicles', createVehiclesRouter());
  v1.route('/opportunities', createOpportunitiesRouter());
  v1.route('/commercial', createCommercialRouter());
  v1.route('/metrics', createSemanticMetricsRouter());
  v1.route('/ai', createAiRouter());

  app.route('/api/v1', v1);

  return app;
}

const app = createServer();
export default app;
