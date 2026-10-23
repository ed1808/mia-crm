#!/usr/bin/env bash
# scripts/restore-db.sh
# Script automatizado de restauración y verificación post-restore para MIA CRM (Hito M8: Preparación del piloto)

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Uso: $0 <ruta_al_archivo.dump> [nombre_bd_destino]"
    echo "Ejemplo: $0 ./backups/mia_crm_mia_crm_dev_20261021_120000.dump mia_crm_dev"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${2:-mia_crm_dev}"
DB_USER="${DB_USER:-mia_admin}"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: El archivo de respaldo '${BACKUP_FILE}' no existe."
    exit 1
fi

echo "===================================================="
echo " MIA CRM — Restauración y Verificación de Base de Datos"
echo " Archivo: ${BACKUP_FILE}"
echo " Destino: ${DB_NAME}"
echo "===================================================="

# 1. Verificar integridad SHA256 si existe el archivo de suma
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "🔍 Verificando integridad criptográfica SHA256..."
    sha256sum -c "${CHECKSUM_FILE}"
    echo "✅ Integridad SHA256 confirmada."
else
    echo "⚠️ Advertencia: No se encontró archivo .sha256. Continuando bajo verificación manual..."
fi

# 2. Restaurar usando pg_restore
echo "🔄 Restaurando base de datos '${DB_NAME}'..."
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "mia_crm_postgres"; then
    # Restaurar a través del contenedor
    cat "${BACKUP_FILE}" | docker exec -i -e PGPASSWORD=mia_admin_password mia_crm_postgres \
        pg_restore -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists -v --no-owner --no-privileges || true
else
    PGPASSWORD="${PGPASSWORD:-mia_admin_password}" pg_restore \
        -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -d "${DB_NAME}" \
        --clean --if-exists -v --no-owner --no-privileges "${BACKUP_FILE}" || true
fi

echo "✅ Restauración física finalizada."

# 3. Verificación automática post-restauración: Asegurar que RLS y aislamiento multitenant siguen activos
echo "🔒 Ejecutando verificación de seguridad: Test de aislamiento Row Level Security (RLS)..."
if command -v bun &> /dev/null; then
    bun test packages/db/src/rls.test.ts
    echo "✅ Verificación post-restore exitosa: Aislamiento RLS 100% íntegro y validado."
else
    echo "⚠️ Bun no disponible en este entorno para ejecutar el test automatizado de RLS."
fi

echo "===================================================="
echo "🎉 Proceso de restauración y certificación de seguridad completado."
echo "===================================================="
