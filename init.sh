#!/usr/bin/env bash
# ==============================================================================
# MIA CRM — Script de Inicialización Rápida (Linux / macOS - Bash & Zsh)
# Inicializa dependencias, infraestructura Docker, migraciones, semillas y build.
# ==============================================================================

set -eo pipefail

# Colores de terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Flags opcionales
SKIP_TESTS=false
SKIP_SEED=false
START_SERVER=false

# Procesar argumentos de línea de comandos
for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --skip-seed)
      SKIP_SEED=true
      shift
      ;;
    --start)
      START_SERVER=true
      shift
      ;;
    --help|-h)
      echo -e "${BOLD}Uso:${NC} ./init.sh [opciones]"
      echo ""
      echo "Opciones:"
      echo "  --start        Inicia el servidor dev (bun run dev) al completar la configuración"
      echo "  --skip-tests   Omite la ejecución de la suite de pruebas automatizadas"
      echo "  --skip-seed    Omite la siembra de datos de prueba y comerciales"
      echo "  --help, -h     Muestra esta ayuda"
      exit 0
      ;;
    *)
      # Argumento desconocido
      ;;
  esac
done

echo -e "${CYAN}${BOLD}"
echo "========================================================================"
echo "         MIA CRM — Plataforma CRM Automotriz Multitenant"
echo "                 Inicializador de Entorno Local"
echo "========================================================================"
echo -e "${NC}"

# 1. Validar directorio raíz del proyecto
if [ ! -f "package.json" ] || [ ! -f "infra/docker-compose.yml" ]; then
  echo -e "${RED}[ERROR] Este script debe ejecutarse desde la raíz del repositorio mia-crm.${NC}"
  exit 1
fi

# 2. Validar prerrequisito: Bun
echo -e "${BLUE}[1/7] Verificando entorno de ejecución Bun...${NC}"
if ! command -v bun &> /dev/null; then
  echo -e "${RED}[ERROR] 'bun' no está instalado o no se encuentra en el PATH.${NC}"
  echo -e "Instálalo ejecutando: ${BOLD}curl -fsSL https://bun.sh/install | bash${NC}"
  exit 1
fi
BUN_VERSION=$(bun --version)
echo -e "${GREEN}✓ Bun detectado (v${BUN_VERSION})${NC}"

# 3. Validar prerrequisito: Docker & Docker Compose
echo -e "\n${BLUE}[2/7] Verificando Docker y Docker Compose...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}[ERROR] 'docker' no está instalado o no se encuentra en el PATH.${NC}"
  echo "Por favor instala Docker Desktop o Docker Engine antes de continuar."
  exit 1
fi

if ! docker info &> /dev/null; then
  echo -e "${RED}[ERROR] El demonio de Docker no parece estar en ejecución.${NC}"
  echo "Por favor inicia Docker antes de continuar."
  exit 1
fi

# Determinar comando de compose
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  echo -e "${RED}[ERROR] No se encontró el comando 'docker compose' ni 'docker-compose'.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker en ejecución con ${DOCKER_COMPOSE}${NC}"

# 4. Instalar dependencias con Bun
echo -e "\n${BLUE}[3/7] Instalando dependencias del monorepo con Bun...${NC}"
bun install
echo -e "${GREEN}✓ Dependencias sincronizadas correctamente.${NC}"

# 5. Levantar contenedores de infraestructura
echo -e "\n${BLUE}[4/7] Iniciando servicios de infraestructura (PostgreSQL 18, Redis, RabbitMQ, ERP Sim, Mailpit)...${NC}"
$DOCKER_COMPOSE -f infra/docker-compose.yml up -d

echo -e "${CYAN}Esperando a que PostgreSQL esté listo para aceptar conexiones...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
PG_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker exec mia_crm_postgres pg_isready -U mia_admin -d mia_crm_dev &> /dev/null; then
    PG_READY=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

if [ "$PG_READY" = false ]; then
  echo -e "${RED}[ERROR] Tiempo de espera agotado esperando a PostgreSQL.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL listo y aceptando conexiones.${NC}"

echo -e "${CYAN}Esperando a que Redis esté listo...${NC}"
RETRY_COUNT=0
REDIS_READY=false
while [ $RETRY_COUNT -lt 15 ]; do
  if docker exec mia_crm_redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    REDIS_READY=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

if [ "$REDIS_READY" = true ]; then
  echo -e "${GREEN}✓ Redis listo (PONG).${NC}"
else
  echo -e "${YELLOW}! Advertencia: Redis tardó en responder, continuando...${NC}"
fi

# 6. Aplicar migraciones y semillas
echo -e "\n${BLUE}[5/7] Ejecutando migraciones de base de datos...${NC}"
bun run db:migrate

if [ "$SKIP_SEED" = false ]; then
  echo -e "\n${CYAN}Sembrando datos iniciales y comerciales de prueba...${NC}"
  bun run db:seed
  echo -e "${GREEN}✓ Base de datos poblada con datos demo del sector automotriz.${NC}"
else
  echo -e "${YELLOW}Siembra de datos omitida (--skip-seed).${NC}"
fi

# 7. Compilar frontend
echo -e "\n${BLUE}[6/7] Compilando bundle de Frontend (React + Bun)...${NC}"
bun run build:web
echo -e "${GREEN}✓ Artefactos web compilados en apps/web/dist.${NC}"

# 8. Ejecutar pruebas automatizadas
echo -e "\n${BLUE}[7/7] Verificando suite de pruebas automatizadas...${NC}"
if [ "$SKIP_TESTS" = false ]; then
  bun test
  echo -e "${GREEN}✓ Todas las pruebas pasaron satisfactoriamente.${NC}"
else
  echo -e "${YELLOW}Pruebas automatizadas omitidas (--skip-tests).${NC}"
fi

# Resumen de Servicios y Acceso
echo -e "\n${GREEN}${BOLD}========================================================================${NC}"
echo -e "${GREEN}${BOLD}       ¡Inicialización de MIA CRM completada con éxito!${NC}"
echo -e "${GREEN}${BOLD}========================================================================${NC}"
echo ""
echo -e "  ${BOLD}Aplicación Web & API:${NC}      http://localhost:3000"
echo -e "  ${BOLD}Salud y Monitoreo:${NC}          http://localhost:3000/health"
echo -e "  ${BOLD}Métricas Prometheus:${NC}        http://localhost:3000/metrics"
echo -e "  ${BOLD}RabbitMQ Management:${NC}        http://localhost:15672 (user: mia_rabbit / pass: mia_rabbit_password)"
echo -e "  ${BOLD}Mailpit (Mock Emails):${NC}      http://localhost:8025"
echo -e "  ${BOLD}PostgreSQL 18 (pgvector):${NC}   localhost:5432 (user: mia_admin / db: mia_crm_dev)"
echo -e "  ${BOLD}Simulador ERP DMS (MSSQL):${NC}  localhost:1433 (user: sa / pass: Mond4ERP_Password!2026)"
echo ""
echo -e "${CYAN}Comandos útiles:${NC}"
echo -e "  Iniciar servidor de desarrollo:  ${BOLD}bun run dev${NC}"
echo -e "  Ejecutar suite de pruebas:       ${BOLD}bun test${NC}"
echo -e "  Asistente onboarding de piloto:  ${BOLD}bun run scripts/onboarding-wizard.ts${NC}"
echo -e "  Prueba de carga y concurrencia:  ${BOLD}bun run scripts/load-test.ts${NC}"
echo -e "  Detener infraestructura:         ${BOLD}docker compose -f infra/docker-compose.yml down${NC}"
echo ""

if [ "$START_SERVER" = true ]; then
  echo -e "${CYAN}Iniciando servidor de desarrollo ahora... (Presiona Ctrl+C para detener)${NC}\n"
  bun run dev
fi
