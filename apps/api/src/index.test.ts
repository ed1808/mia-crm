import { describe, expect, it } from 'bun:test';
import { createServer } from './index';

describe('API Server integration & Pilot Observability / Security (M8)', () => {
  const app = createServer();

  it('responds with 200 on /health (Liveness Probe)', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('mia-crm-api');
  });

  it('responds with 200 on /health/ready with deep PostgreSQL, Redis and RabbitMQ status', async () => {
    const res = await app.request('/health/ready');
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      status: string;
      checks: {
        postgres: { status: string; latencyMs: number };
        redis: { status: string };
        rabbitmq: { status: string };
      };
    };
    expect(body.status).toBe('healthy');
    expect(body.checks.postgres.status).toBe('up');
    expect(body.checks.redis.status).toBe('up');
    expect(body.checks.rabbitmq.status).toBe('up');
  });

  it('exposes Prometheus / OpenMetrics metrics on /metrics', async () => {
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');

    const text = await res.text();
    expect(text).toContain('mia_process_uptime_seconds');
    expect(text).toContain('mia_http_requests_total');
  });

  it('injects security headers and correlation ID (x-request-id)', async () => {
    const res = await app.request('/api/v1/status');
    expect(res.status).toBe(200);

    // Security headers
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBeDefined();

    // Correlation ID
    expect(res.headers.get('x-request-id')).toBeDefined();
    expect(res.headers.get('x-request-id')?.length).toBeGreaterThan(10);
  });
});
