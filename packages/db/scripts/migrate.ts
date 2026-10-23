import { join } from 'node:path';
import { SQL } from 'bun';
import { runMigrations } from '../src/migrator';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';

async function main() {
  console.log('Iniciando migrador sobre Bun.sql...');
  const sql = new SQL(DATABASE_URL);

  const migrationsDir = join(import.meta.dir, '../../../db/migrations');
  console.log(`Buscando migraciones en: ${migrationsDir}`);

  const applied = await runMigrations(sql, { migrationsDir });
  if (applied.length === 0) {
    console.log('No hay nuevas migraciones para aplicar. Base de datos al día.');
  } else {
    console.log(`Migraciones aplicadas exitosamente (${applied.length}):`);
    for (const v of applied) {
      console.log(`  ✓ ${v}`);
    }
  }

  await sql.close();
}

main().catch((err) => {
  console.error('Error ejecutando migraciones:', err);
  process.exit(1);
});
