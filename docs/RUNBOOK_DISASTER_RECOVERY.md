# MIA CRM — Runbook Operativo y Procedimiento de Recuperación ante Desastres (Disaster Recovery)
**Hito M8: Preparación del Piloto de Concesionario**
*Procedimientos Técnicos para DevOps, Infraestructura y Respaldo Continuo*

---

## 1. Objetivos del Servicio (RTO y RPO)

Para el despliegue del piloto operativo de MIA CRM, se establecen los siguientes objetivos de recuperación:
- **RPO (Recovery Point Objective):** $\le 1$ hora (pérdida máxima admisible de datos mediante respaldos continuos y outbox).
- **RTO (Recovery Time Objective):** $\le 15$ minutos (tiempo máximo para restaurar la operatividad completa del servicio).

---

## 2. Procedimiento de Respaldo de Base de Datos (Backups)

### 2.1 Ejecución Manual
Para realizar un volcado consistente con verificación SHA256:
```bash
./scripts/backup-db.sh
```
El archivo se almacena en `./backups/mia_crm_<bd>_<timestamp>.dump` con su correspondiente archivo `.sha256`.

### 2.2 Programación Recurrente (Cron Job en Servidor)
Configurar en el crontab del servidor de producción (`crontab -e`):
```cron
# Respaldo automático de MIA CRM cada 6 horas y rotación a 30 días
0 */6 * * * /opt/mia-crm/scripts/backup-db.sh >> /var/log/mia_backup.log 2>&1
# Limpieza de respaldos locales con más de 30 días de antigüedad
0 3 * * * find /opt/mia-crm/backups -name "*.dump*" -mtime +30 -delete
```

---

## 3. Procedimiento de Restauración (Restores)

### 3.1 Pasos de Restauración con Verificación de Integridad
1. **Identificar el archivo de respaldo a restaurar:**
   ```bash
   ls -la backups/
   ```
2. **Ejecutar el script automatizado de restauración:**
   ```bash
   ./scripts/restore-db.sh backups/mia_crm_mia_crm_dev_20261021_185430.dump mia_crm_dev
   ```
3. **Validación Automática Post-Restore:**
   El script ejecuta de manera obligatoria la suite de aislamiento multitenant:
   ```bash
   bun test packages/db/src/rls.test.ts
   ```
   Si alguna tabla pierde la política RLS o el rol `mia_app` puede ver datos de otro tenant, la restauración reportará alerta crítica inmediatamente.

---

## 4. Exportación Selectiva por Tenant (Portabilidad & Ley 1581)

En caso de que un concesionario requiera la portabilidad completa de sus datos o solicite su retiro:
```bash
bun run scripts/export-tenant.ts <slug_o_id_del_tenant>
```
Ejemplo:
```bash
bun run scripts/export-tenant.ts andina-motors
```
Genera un archivo JSON estructurado bajo `./backups/tenant_export_<slug>_<timestamp>.json` conteniendo sedes, usuarios, clientes, vehículos, órdenes de trabajo, oportunidades y embudos, garantizando la total separación respecto a otros tenants.

---

## 5. Rotación de Credenciales y Secretos de Seguridad

| Secreto / Componente | Procedimiento de Rotación |
|---|---|
| **Contraseña PostgreSQL (`mia_admin` / `mia_app`)** | `ALTER USER mia_app WITH PASSWORD 'nuevo_password';` actualizar variable `APP_DATABASE_URL` y reiniciar servicio con cero downtime. |
| **Claves de API de Conectores ERP** | Generar nuevo token en tabla `connectors`, hashear con SHA-256 (`api_key_hash`), actualizar en el adaptador del ERP y desactivar token anterior (`is_active = false`). |
| **Sesiones Redis** | Ejecutar `redis-cli FLUSHDB` o invocar caso de uso `revokeAllSessions(userId)` para forzar re-autenticación con MFA. |

---

## 6. Monitoreo y Diagnóstico de Incidentes

### 6.1 Sondas de Salud (Healthchecks)
- **Liveness:** `GET /health` $\rightarrow$ Valida que el proceso HTTP de Bun está vivo.
- **Deep Readiness:** `GET /health/ready` $\rightarrow$ Valida conectividad activa hacia PostgreSQL, Redis y RabbitMQ con métricas de latencia.

### 6.2 Métricas del Sistema (Prometheus)
- **Endpoint:** `GET /metrics` $\rightarrow$ Expone contadores de peticiones HTTP, percentiles de latencia p50/p95, ejecuciones de IA por nivel D-15 y consumo de memoria RSS.

### 6.3 Pruebas de Carga de Validación Previa a Producción
```bash
bun run scripts/load-test.ts
```
Valida que el sistema soporte al menos 15 workers concurrentes manteniendo una latencia p95 inferior a 500 ms con 0% de errores.
