import { resolve } from 'node:path';
import { runMigrations } from '@mia-crm/db';
import { SQL } from 'bun';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';

async function main() {
  const migrationsDir = resolve(import.meta.dir, '../db/migrations');
  console.log('[Migraciones] Conectando a PostgreSQL...');
  const sql = new SQL(DATABASE_URL);

  try {
    console.log(`[Migraciones] Leyendo migraciones desde ${migrationsDir}...`);
    const applied = await runMigrations(sql, { migrationsDir });

    if (applied.length === 0) {
      console.log('[Migraciones] La base de datos ya está al día. No hay migraciones pendientes.');
    } else {
      console.log(`[Migraciones] ${applied.length} migraciones aplicadas exitosamente:`);
      for (const m of applied) {
        console.log(`  ✓ ${m}`);
      }
    }
  } catch (err) {
    console.error('[Migraciones] Error al ejecutar migraciones:', err);
    process.exit(1);
  } finally {
    await sql.close();
  }
}

main();
