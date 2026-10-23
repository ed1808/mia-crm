import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { withTenant } from '@mia-crm/db';
import { SQL } from 'bun';
import {
  AuthenticateUserUseCase,
  BunArgon2PasswordHasher,
  BunSqlUserRepository,
  RegisterUserUseCase,
} from './index';

const ADMIN_DB = 'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DB = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Identity Module: PostgreSQL Integration with Bun.sql and RLS', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  const hasher = new BunArgon2PasswordHasher();

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DB);
    appSql = new SQL(APP_DB);

    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug) VALUES ('Automotriz Central S.A.', 'automotriz-central')
      RETURNING id
    `;
    tenantId = t!.id;
  });

  afterAll(async () => {
    if (adminSql && tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
  });

  it('persists user via RegisterUserUseCase and verifies password with argon2id', async () => {
    // 1. Registro dentro del contexto de tenant
    const registerResult = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlUserRepository(tx);
      const useCase = new RegisterUserUseCase(repo, hasher);

      return await useCase.execute({
        tenantId,
        email: 'carlos.mora@automotrizcentral.co',
        password: 'PasswordSeguro2026!#',
        fullName: 'Carlos Mora',
        role: 'service_advisor',
      });
    });

    expect(registerResult.ok).toBe(true);
    if (!registerResult.ok) return;

    // 2. Autenticación validando hash en BD
    const authResult = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlUserRepository(tx);
      const useCase = new AuthenticateUserUseCase(repo, hasher);

      return await useCase.execute({
        email: 'carlos.mora@automotrizcentral.co',
        password: 'PasswordSeguro2026!#',
      });
    });

    expect(authResult.ok).toBe(true);
    if (authResult.ok) {
      expect(authResult.value.user.email.value).toBe('carlos.mora@automotrizcentral.co');
      expect(authResult.value.user.role.value).toBe('service_advisor');
      expect(authResult.value.requiresMfa).toBe(false); // Asesor operativo no tiene MFA forzado en login primario
    }
  });
});
