// scripts/load-test.ts
// Suite automatizada de pruebas de carga y estrés para MIA CRM (Hito M8: Preparación del piloto)

import { performance } from 'perf_hooks';

interface LoadTestScenario {
  name: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}

interface RunMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationsMs: number[];
  rps: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const CONCURRENCY = Number(process.env.CONCURRENCY || 15);
const TOTAL_OPERATIONS = Number(process.env.TOTAL_OPERATIONS || 150);

async function executeScenario(scenario: LoadTestScenario): Promise<{ success: boolean; durationMs: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}${scenario.url}`, {
      method: scenario.method,
      headers: {
        'Content-Type': 'application/json',
        ...(scenario.headers || {}),
      },
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
    });
    const durationMs = performance.now() - start;
    const success = res.status >= 200 && res.status < 400;
    // Consumir el body para liberar sockets
    await res.text();
    return { success, durationMs };
  } catch (_e) {
    const durationMs = performance.now() - start;
    return { success: false, durationMs };
  }
}

async function runWorker(
  workerId: number,
  scenarios: LoadTestScenario[],
  requestsPerWorker: number,
  results: { success: boolean; durationMs: number }[],
) {
  for (let i = 0; i < requestsPerWorker; i++) {
    const scenario = scenarios[(workerId + i) % scenarios.length];
    const res = await executeScenario(scenario);
    results.push(res);
  }
}

async function main() {
  console.log(`================================================================`);
  console.log(` ⚡ MIA CRM — Suite de Pruebas de Carga y Estrés (Hito M8)`);
  console.log(` Servidor objetivo: ${API_BASE_URL}`);
  console.log(` Concurrencia:      ${CONCURRENCY} workers paralelos`);
  console.log(` Operaciones:       ${TOTAL_OPERATIONS} solicitudes totales`);
  console.log(`================================================================`);

  // Escenarios realistas de carga del concesionario
  const scenarios: LoadTestScenario[] = [
    {
      name: 'Liveness Probe',
      url: '/health',
      method: 'GET',
    },
    {
      name: 'Deep Readiness Healthcheck',
      url: '/health/ready',
      method: 'GET',
    },
    {
      name: 'Prometheus Metrics Scraping',
      url: '/metrics',
      method: 'GET',
    },
    {
      name: 'Consulta de Vehículos 360',
      url: '/api/v1/vehicles?limit=10',
      method: 'GET',
    },
    {
      name: 'Consulta de Oportunidades Mi Día',
      url: '/api/v1/opportunities?limit=10',
      method: 'GET',
    },
    {
      name: 'Capa Semántica: KPI Tasa de Retención (D-16)',
      url: '/api/v1/metrics/query?kpi=vehicle_retention_rate&dimension=make',
      method: 'GET',
    },
    {
      name: 'Copiloto IA: Consulta Rápida',
      url: '/api/v1/ai/chat',
      method: 'POST',
      body: {
        role: 'sales_advisor',
        message: '¿Cuáles leads tienen SLA crítico?',
      },
    },
  ];

  const requestsPerWorker = Math.ceil(TOTAL_OPERATIONS / CONCURRENCY);
  const results: { success: boolean; durationMs: number }[] = [];

  const wallClockStart = performance.now();

  // Lanzar workers concurrentes
  const workers: Promise<void>[] = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(runWorker(w, scenarios, requestsPerWorker, results));
  }

  await Promise.all(workers);

  const totalWallClockSeconds = (performance.now() - wallClockStart) / 1000;
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const successfulCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successfulCount;

  const metrics: RunMetrics = {
    totalRequests: results.length,
    successfulRequests: successfulCount,
    failedRequests: failedCount,
    durationsMs: durations,
    rps: Math.round(results.length / totalWallClockSeconds),
    p50: Math.round(durations[Math.floor(durations.length * 0.5)] || 0),
    p90: Math.round(durations[Math.floor(durations.length * 0.9)] || 0),
    p95: Math.round(durations[Math.floor(durations.length * 0.95)] || 0),
    p99: Math.round(durations[Math.floor(durations.length * 0.99)] || 0),
    min: Math.round(durations[0] || 0),
    max: Math.round(durations[durations.length - 1] || 0),
  };

  const successRate = ((successfulCount / results.length) * 100).toFixed(2);

  console.log(`\n📊 RESULTADOS DE RENDIMIENTO Y LATENCIA:`);
  console.log(`----------------------------------------------------------------`);
  console.log(` Solicitudes Procesadas: ${metrics.totalRequests}`);
  console.log(` Tasa de Éxito:          ${successRate}% (${successfulCount} OK, ${failedCount} fallos)`);
  console.log(` Rendimiento Throughput: ${metrics.rps} req/seg (RPS)`);
  console.log(` Tiempo Total del Test:  ${totalWallClockSeconds.toFixed(2)} segundos`);
  console.log(`----------------------------------------------------------------`);
  console.log(` Latencia Mínima:        ${metrics.min} ms`);
  console.log(` Latencia Mediana (p50): ${metrics.p50} ms`);
  console.log(` Latencia p90:           ${metrics.p90} ms`);
  console.log(` Latencia p95:           ${metrics.p95} ms`);
  console.log(` Latencia p99:           ${metrics.p99} ms`);
  console.log(` Latencia Máxima:        ${metrics.max} ms`);
  console.log(`================================================================`);

  // Verificación de SLOs del Piloto
  const sloSuccessRateMet = Number(successRate) >= 99.0;
  const sloLatencyMet = metrics.p95 <= 500; // SLA exigido para piloto

  if (sloSuccessRateMet && sloLatencyMet) {
    console.log(`✅ ¡SLOs de Preparación del Piloto CUMPLIDOS SATISFACTORIAMENTE!`);
    console.log(`   - Tasa de éxito >= 99.0%: CUMPLE (${successRate}%)`);
    console.log(`   - Latencia p95 <= 500ms:   CUMPLE (${metrics.p95}ms)`);
  } else {
    console.warn(`⚠️ Advertencia: Algunos SLOs requieren optimización de recursos.`);
  }

  process.exit(sloSuccessRateMet ? 0 : 1);
}

main().catch((err) => {
  console.error('Error fatal en prueba de carga:', err);
  process.exit(1);
});
