#!/usr/bin/env bash
# scripts/backup-db.sh
# Script automatizado de respaldo consistente de PostgreSQL para MIA CRM (Hito M8: Preparación del piloto)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-mia_crm_dev}"
DB_USER="${DB_USER:-mia_admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_FILE="${BACKUP_DIR}/mia_crm_${DB_NAME}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "===================================================="
echo " MIA CRM — Respaldo de Base de Datos PostgreSQL"
echo " Fecha: $(date -Iseconds)"
echo " Base de datos: ${DB_NAME} en ${DB_HOST}:${DB_PORT}"
echo "===================================================="

# Verificar docker o pg_dump local
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "mia_crm_postgres"; then
    echo "📦 Ejecutando pg_dump consistente vía contenedor 'mia_crm_postgres'..."
    docker exec -e PGPASSWORD=mia_admin_password mia_crm_postgres \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v > "${BACKUP_FILE}"
else
    echo "📦 Ejecutando pg_dump local..."
    PGPASSWORD="${PGPASSWORD:-mia_admin_password}" pg_dump \
        -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -F c -b -v -f "${BACKUP_FILE}"
fi

# Generar checksum SHA256
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Respaldo completado exitosamente:"
echo "   Archivo:  ${BACKUP_FILE} (${SIZE})"
echo "   Checksum: $(cat "${CHECKSUM_FILE}")"
echo "===================================================="
