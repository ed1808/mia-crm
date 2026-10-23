import { Hono } from 'hono';
import { withTenant } from '@mia-crm/db';
import {
  BunSqlMetricsRepository,
  ExplainMetricUseCase,
  ListKpiDefinitionsUseCase,
  QueryMetricUseCase,
  type MetricDimension,
} from '@mia-crm/module-metrics';
import { tenantMiddleware } from '../middleware/tenant';

export function createMetricsRouter() {
  const router = new Hono();

  router.use('*', tenantMiddleware);

  // GET /api/v1/metrics/definitions — Listado de métricas y KPIs gobernados
  router.get('/definitions', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const kpis = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      const useCase = new ListKpiDefinitionsUseCase(repo);
      return await useCase.execute();
    });

    return c.json({
      data: kpis.map((k) => ({
        code: k.code,
        name: k.name,
        description: k.description,
        formula: k.formula,
        category: k.category,
        unit: k.unit,
        version: k.version,
      })),
    });
  });

  // GET /api/v1/metrics/explain/:code — Explicación de fórmula e interpretación de negocio
  router.get('/explain/:code', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const code = c.req.param('code');

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      const useCase = new ExplainMetricUseCase(repo);
      return await useCase.execute(code);
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 404);
    }

    return c.json({ data: result.value });
  });

  // GET /api/v1/metrics/query — Ejecución gobernada de consulta de métrica
  router.get('/query', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const kpiCode = c.req.query('kpi');
    if (!kpiCode) {
      return c.json({ error: 'Parámetro kpi es obligatorio', code: 'MISSING_KPI_PARAM' }, 400);
    }

    const dimension = c.req.query('dimension') as MetricDimension | undefined;
    const make = c.req.query('make');
    const vehicleType = c.req.query('vehicleType');

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      const useCase = new QueryMetricUseCase(repo);
      return await useCase.execute({
        kpiCode,
        dimensions: dimension ? [dimension] : undefined,
        filters: {
          make: make || undefined,
          vehicleType: vehicleType || undefined,
        },
      });
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: result.value });
  });

  // GET /api/v1/metrics/dashboard — Panel Ejecutivo Completo de Métricas Gobernadas
  router.get('/dashboard', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const data = await withTenant(db, { tenantId }, async (tx) => {
      const repo = new BunSqlMetricsRepository(tx);
      return await repo.getExecutiveDashboard();
    });

    return c.json({ data });
  });

  return router;
}
