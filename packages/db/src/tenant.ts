import type { SQL } from 'bun';

export interface TenantContext {
  readonly tenantId: string;
  readonly userId?: string;
  readonly scope?: string; // 'own' | 'team' | 'branch' | 'org'
}

/**
 * Ejecuta una operación de base de datos bajo aislamiento estricto de Tenant (RLS).
 * Utiliza transacciones de PostgreSQL con SET LOCAL para garantizar que las variables
 * de sesión no contaminen el pool de conexiones.
 */
export async function withTenant<T>(
  sql: SQL,
  ctx: TenantContext,
  fn: (tx: SQL) => Promise<T>,
): Promise<T> {
  return await sql.begin(async (tx) => {
    // Fijamos las variables de sesión para las políticas de Row-Level Security
    await tx`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    if (ctx.userId) {
      await tx`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
    }
    if (ctx.scope) {
      await tx`SELECT set_config('app.scope', ${ctx.scope}, true)`;
    }

    return await fn(tx);
  });
}
