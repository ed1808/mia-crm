// apps/api/src/middleware/observability.ts
import type { Context, Next } from 'hono';

export interface MetricEntry {
  method: string;
  path: string;
  status: number;
  durationSeconds: number;
}

class MetricsRegistry {
  private requestsTotal: Map<string, number> = new Map();
  private requestDurations: Map<string, number[]> = new Map();
  private aiToolExecutions: Map<string, number> = new Map();
  private startTime: number = Date.now();

  public recordRequest(method: string, path: string, status: number, durationSeconds: number) {
    // Normalizar paths con IDs dinámicos para evitar explosión de cardinalidad
    const normalizedPath = this.normalizePath(path);
    const key = `${method}:${normalizedPath}:${status}`;
    this.requestsTotal.set(key, (this.requestsTotal.get(key) || 0) + 1);

    const durationKey = `${method}:${normalizedPath}`;
    let durations = this.requestDurations.get(durationKey);
    if (!durations) {
      durations = [];
      this.requestDurations.set(durationKey, durations);
    }
    // Guardar últimas 500 muestras por ruta para percentiles
    if (durations.length >= 500) durations.shift();
    durations.push(durationSeconds);
  }

  public recordAiToolExecution(toolName: string, autonomyLevel: number, status: string) {
    const key = `${toolName}:${autonomyLevel}:${status}`;
    this.aiToolExecutions.set(key, (this.aiToolExecutions.get(key) || 0) + 1);
  }

  private normalizePath(path: string): string {
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/[A-Z0-9]{3}[0-9]{3}\b/g, '/:plate')
      .replace(/\/[A-Z0-9]{3}[0-9]{2}[A-Z]\b/g, '/:plate')
      .replace(/\/\d+/g, '/:id');
  }

  public toPrometheusFormat(): string {
    const lines: string[] = [];

    // 1. Process uptime & memory
    const uptime = (Date.now() - this.startTime) / 1000;
    const mem = process.memoryUsage();
    lines.push('# HELP mia_process_uptime_seconds Tiempo en segundos desde el inicio del proceso');
    lines.push('# TYPE mia_process_uptime_seconds gauge');
    lines.push(`mia_process_uptime_seconds ${uptime.toFixed(2)}`);

    lines.push('# HELP mia_process_resident_memory_bytes Memoria residente (RSS) en bytes');
    lines.push('# TYPE mia_process_resident_memory_bytes gauge');
    lines.push(`mia_process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP mia_process_heap_used_bytes Memoria de heap utilizada en bytes');
    lines.push('# TYPE mia_process_heap_used_bytes gauge');
    lines.push(`mia_process_heap_used_bytes ${mem.heapUsed}`);

    // 2. HTTP Requests Total
    lines.push('# HELP mia_http_requests_total Total de peticiones HTTP procesadas');
    lines.push('# TYPE mia_http_requests_total counter');
    for (const [key, count] of this.requestsTotal.entries()) {
      const [method, path, status] = key.split(':');
      lines.push(
        `mia_http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`,
      );
    }

    // 3. HTTP Request Durations (Summary / p95)
    lines.push('# HELP mia_http_request_duration_seconds Latencia de peticiones HTTP en segundos');
    lines.push('# TYPE mia_http_request_duration_seconds summary');
    for (const [key, samples] of this.requestDurations.entries()) {
      if (samples.length === 0) continue;
      const [method, path] = key.split(':');
      const sorted = [...samples].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
      const sum = sorted.reduce((acc, v) => acc + v, 0);

      lines.push(
        `mia_http_request_duration_seconds{method="${method}",path="${path}",quantile="0.5"} ${p50.toFixed(4)}`,
      );
      lines.push(
        `mia_http_request_duration_seconds{method="${method}",path="${path}",quantile="0.95"} ${p95.toFixed(4)}`,
      );
      lines.push(`mia_http_request_duration_seconds_sum{method="${method}",path="${path}"} ${sum.toFixed(4)}`);
      lines.push(`mia_http_request_duration_seconds_count{method="${method}",path="${path}"} ${samples.length}`);
    }

    // 4. AI Tool Executions Total
    lines.push('# HELP mia_ai_tool_executions_total Ejecuciones de herramientas del Copiloto IA (D-15)');
    lines.push('# TYPE mia_ai_tool_executions_total counter');
    for (const [key, count] of this.aiToolExecutions.entries()) {
      const [tool, level, status] = key.split(':');
      lines.push(
        `mia_ai_tool_executions_total{tool="${tool}",autonomy_level="${level}",status="${status}"} ${count}`,
      );
    }

    return lines.join('\n') + '\n';
  }

  public getSummary() {
    return {
      uptimeSeconds: (Date.now() - this.startTime) / 1000,
      totalRequests: Array.from(this.requestsTotal.values()).reduce((a, b) => a + b, 0),
      routesTracked: this.requestsTotal.size,
      aiExecutionsTracked: Array.from(this.aiToolExecutions.values()).reduce((a, b) => a + b, 0),
    };
  }
}

export const metrics = new MetricsRegistry();

export async function observabilityMiddleware(c: Context, next: Next) {
  const start = performance.now();
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();

  // Inyectar correlation ID en la respuesta
  c.header('x-request-id', requestId);

  await next();

  const durationSeconds = (performance.now() - start) / 1000;
  const path = c.req.path;
  const method = c.req.method;
  const status = c.res.status;

  // Registrar métricas
  metrics.recordRequest(method, path, status, durationSeconds);

  // Log estructurado (omitir para llamadas a métricas o health liviano para no ensuciar)
  if (!path.startsWith('/health') && path !== '/metrics') {
    const tenantId = c.get('tenant')?.tenantId || 'anonymous';
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      tenantId,
      method,
      path,
      status,
      latencyMs: Math.round(durationSeconds * 1000),
    };
    // Emitir en una sola línea JSON compatible con FluentBit/Datadog/CloudWatch
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logData));
    }
  }
}
