import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { withTenant } from '@mia-crm/db';
import {
  BunArgon2PasswordHasher,
  BunSqlUserRepository,
  RedisSessionStore,
  RegisterUserUseCase,
} from '@mia-crm/module-identity';
import { createServer } from './index';

const ADMIN_DB = 'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DB = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Auth HTTP Endpoints (/api/v1/auth)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let sessionStore: RedisSessionStore;
  const hasher = new BunArgon2PasswordHasher();

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DB);
    appSql = new SQL(APP_DB);
    sessionStore = new RedisSessionStore();

    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug) VALUES ('Automotriz del Llano', 'automotriz-llano')
      RETURNING id
    `;
    tenantId = t!.id;

    // Crear usuario de prueba en base de datos
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlUserRepository(tx);
      const useCase = new RegisterUserUseCase(repo, hasher);
      await useCase.execute({
        tenantId,
        email: 'test.asesor@mia.co',
        password: 'PasswordSuperSeguro2026!',
        fullName: 'Fernando Ruiz',
        role: 'sales_advisor',
      });
    });
  });

  afterAll(async () => {
    if (adminSql && tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
    await sessionStore.close();
  });

  it('authenticates user and returns session cookie, then accesses /me and logouts', async () => {
    const app = createServer();

    // 1. Login exitoso
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test.asesor@mia.co',
        password: 'PasswordSuperSeguro2026!',
        tenantId,
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      user: { email: string; fullName: string };
      requiresMfa: boolean;
    };
    expect(loginBody.user.email).toBe('test.asesor@mia.co');
    expect(loginBody.requiresMfa).toBe(false);

    // Cookie HttpOnly recibida
    const cookieHeader = loginRes.headers.get('set-cookie');
    expect(cookieHeader).not.toBeNull();
    expect(cookieHeader).toContain('mia_session=');

    // Extraer valor de la cookie
    const match = cookieHeader?.match(/mia_session=([^;]+)/);
    const cookieValue = match ? match[1] : '';
    expect(cookieValue).not.toBeEmpty();

    // 2. Consultar /me con la cookie
    const meRes = await app.request('/api/v1/auth/me', {
      headers: { Cookie: `mia_session=${cookieValue}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { session: { email: string; role: string } };
    expect(meBody.session.email).toBe('test.asesor@mia.co');
    expect(meBody.session.role).toBe('sales_advisor');

    // 3. Logout
    const logoutRes = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Cookie: `mia_session=${cookieValue}` },
    });
    expect(logoutRes.status).toBe(200);

    // 4. /me debe rechazar ahora con 401
    const meAfterLogout = await app.request('/api/v1/auth/me', {
      headers: { Cookie: `mia_session=${cookieValue}` },
    });
    expect(meAfterLogout.status).toBe(401);
  });
});
