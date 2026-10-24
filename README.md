# MIA CRM — Plataforma CRM Predictiva para Concesionarios y Talleres Automotrices

MIA CRM es una plataforma automotriz multitenant de alto rendimiento construida con **Bun**, **Hono**, **React**, **PostgreSQL 18** (con `pgvector` y RLS estricto), **Redis** y **RabbitMQ**.

---

## 🚀 Inicialización Rápida (Quickstart)

El proyecto incluye scripts automatizados para reproducir todo el entorno local con un solo comando tanto en **Linux/macOS** como en **Windows**.

### Prerrequisitos
1. **[Bun](https://bun.sh)** (v1.2+)
   - Linux/macOS: `curl -fsSL https://bun.sh/install | bash`
   - Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
2. **[Docker & Docker Compose](https://www.docker.com/)**
   - Asegúrate de que el servicio de Docker esté en ejecución.

---

### Opción 1: Linux / macOS (Bash & Zsh)

Otorga permisos de ejecución (si no los tiene) y corre el script:

```bash
chmod +x init.sh
./init.sh
```

#### Opciones disponibles:
- `./init.sh --start` : Inicia el servidor fullstack (`bun run dev`) automáticamente al finalizar.
- `./init.sh --skip-tests` : Omite la ejecución de las 109 pruebas automatizadas.
- `./init.sh --skip-seed` : Omite la siembra de datos de prueba.

---

### Opción 2: Windows (PowerShell)

Abre PowerShell en la raíz del repositorio y ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\init.ps1
```

#### Opciones disponibles:
- `.\init.ps1 -StartServer` : Inicia el servidor al completar la inicialización.
- `.\init.ps1 -SkipTests` : Omite la ejecución de pruebas.
- `.\init.ps1 -SkipSeed` : Omite la siembra de datos demo.

---

## 🛠️ ¿Qué hace el script de inicialización?

1. **Valida dependencias:** Comprueba que `bun` y `docker` estén instalados y listos.
2. **Sincroniza monorepo:** Ejecuta `bun install` a través de todos los workspaces.
3. **Levanta infraestructura en Docker:**
   - PostgreSQL 18 con extensión `pgvector` (`localhost:5432`).
   - Redis 7 (`localhost:6379`).
   - RabbitMQ 4 con interfaz de administración (`localhost:5672` / `15672`).
   - Simulador ERP/DMS SQL Server 2022 (`localhost:1433`).
   - Servidor SMTP local Mailpit (`localhost:1025` / Web UI `8025`).
4. **Espera Readiness:** Comprueba la disponibilidad real de PostgreSQL y Redis mediante healthchecks activos.
5. **Ejecuta Migraciones:** Aplica los 13 scripts DDL de `db/migrations` con trazabilidad en `schema_migrations`.
6. **Siembra Datos (Idempotente):**
   - Tenant demo de Colombia (`demo-colombia`).
   - Flotas y vehículos reales con placas colombianas (`ABC123`, `MED345`, `STR889`, `TLX111`, `VLM444`).
   - Pipelines comerciales automotrices (Nuevos, Pesados, Retoma y Flotas B2B).
   - Oportunidades con temporizadores SLA y cotizaciones formalizadas.
7. **Compila Frontend Web:** Genera el bundle React optimizado con Bun en `apps/web/dist`.
8. **Ejecuta Tests:** Corre la suite completa de 109 pruebas garantizando 100% de cobertura funcional.

---

## 🌐 URLs y Servicios Locales

| Servicio | URL / Host | Credenciales por Defecto |
| :--- | :--- | :--- |
| **Web UI & API** | [http://localhost:3000](http://localhost:3000) | Sesión / Tenant `demo-colombia` |
| **Salud del Sistema** | [http://localhost:3000/health](http://localhost:3000/health) | N/A |
| **Readiness Check** | [http://localhost:3000/health/ready](http://localhost:3000/health/ready) | N/A |
| **Métricas Prometheus** | [http://localhost:3000/metrics](http://localhost:3000/metrics) | N/A |
| **RabbitMQ Dashboard** | [http://localhost:15672](http://localhost:15672) | `mia_rabbit` / `mia_rabbit_password` |
| **Mailpit (Correos Mock)** | [http://localhost:8025](http://localhost:8025) | N/A |
| **PostgreSQL 18** | `localhost:5432` (DB `mia_crm_dev`) | `mia_admin` / `mia_admin_password` |
| **Simulador ERP DMS** | `localhost:1433` | `sa` / `Mond4ERP_Password!2026` |

---

## 💻 Comandos de Desarrollo Útiles

- **Iniciar servidor dev (API + Frontend en puerto 3000):**
  ```bash
  bun run dev
  ```
- **Ejecutar suite de pruebas:**
  ```bash
  bun test
  ```
- **Asistente interactivo de onboarding para nuevos concesionarios:**
  ```bash
  bun run scripts/onboarding-wizard.ts
  ```
- **Prueba de carga y concurrencia (Benchmark):**
  ```bash
  bun run scripts/load-test.ts
  ```
- **Detener contenedores Docker:**
  ```bash
  docker compose -f infra/docker-compose.yml down
  ```
