import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { SQL } from 'bun';
import { RedisSessionStore } from '@mia-crm/module-identity';

const sql = new SQL(
  process.env.APP_DATABASE_URL ||
    'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev'
);
const adminSql = new SQL(
  process.env.DATABASE_URL ||
    'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev'
);
const sessionStore = new RedisSessionStore();

export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantContext;
    db: SQL;
  }
}

export async function tenantMiddleware(c: Context, next: Next) {
  let tenantId = c.req.header('x-tenant-id');
  let userId: string | undefined;
  let role: string | undefined;

  // 1. Intentar desde cookie de sesión
  const sessionId = getCookie(c, 'mia_session');
  if (sessionId) {
    try {
      const session = await sessionStore.getSession(sessionId);
      if (session) {
        tenantId = session.tenantId;
        userId = session.userId;
        role = session.role;
      }
    } catch {
      // Ignorar fallo de redis en fallback
    }
  }

  // 2. Si no hay tenant especificado, usar el tenant de demo o el primero disponible
  if (!tenantId) {
    const rows = await adminSql<{ id: string }[]>`
      SELECT id FROM tenants ORDER BY (slug = 'demo-colombia') DESC, created_at DESC LIMIT 1
    `;
    if (rows[0]) {
      tenantId = rows[0].id;
    }
  }

  if (!tenantId) {
    return c.json(
      { error: 'TENANT_REQUIRED', message: 'No se encontró un tenant activo para la operación.' },
      400
    );
  }

  c.set('tenant', { tenantId, userId, role });
  c.set('db', sql);

  await next();
}
