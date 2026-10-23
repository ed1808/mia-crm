import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SQL } from 'bun';

export interface MigrationOptions {
  migrationsDir: string;
}

export async function runMigrations(sql: SQL, options: MigrationOptions): Promise<string[]> {
  // 1. Asegurar tabla de control de migraciones
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Obtener migraciones ya aplicadas
  const appliedRows = await sql<{ version: string }[]>`
    SELECT version FROM schema_migrations ORDER BY version ASC;
  `;
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  // 3. Leer archivos en directorio
  const files = await readdir(options.migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));

  const newlyApplied: string[] = [];

  for (const file of sqlFiles) {
    const version = file.replace(/\.sql$/, '');
    if (appliedSet.has(version)) {
      continue;
    }

    const fullPath = join(options.migrationsDir, file);
    const content = await readFile(fullPath, 'utf8');

    await sql.begin(async (tx) => {
      // Ejecutar script DDL
      await tx.unsafe(content);
      // Registrar versión aplicada
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`;
    });

    newlyApplied.push(version);
  }

  return newlyApplied;
}
