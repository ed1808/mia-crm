# ==============================================================================
# MIA CRM — Script de Inicialización Rápida (Windows - PowerShell)
# Inicializa dependencias, infraestructura Docker, migraciones, semillas y build.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipTests,
    [switch]$SkipSeed,
    [switch]$StartServer,
    [switch]$Help
)

if ($Help) {
    Write-Host "Uso: .\init.ps1 [-SkipTests] [-SkipSeed] [-StartServer] [-Help]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Opciones:"
    Write-Host "  -StartServer   Inicia el servidor dev (bun run dev) al completar la configuracion"
    Write-Host "  -SkipTests     Omite la ejecucion de la suite de pruebas automatizadas"
    Write-Host "  -SkipSeed      Omite la siembra de datos de prueba y comerciales"
    Write-Host "  -Help          Muestra esta ayuda"
    exit 0
}

$ErrorActionPreference = "Stop"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "         MIA CRM — Plataforma CRM Automotriz Multitenant" -ForegroundColor Cyan
Write-Host "                 Inicializador de Entorno Local" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Validar directorio raíz del proyecto
if (-not (Test-Path "package.json") -or -not (Test-Path "infra/docker-compose.yml")) {
    Write-Host "[ERROR] Este script debe ejecutarse desde la raiz del repositorio mia-crm." -ForegroundColor Red
    exit 1
}

# 2. Validar prerrequisito: Bun
Write-Host "[1/7] Verificando entorno de ejecucion Bun..." -ForegroundColor Blue
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCmd) {
    Write-Host "[ERROR] 'bun' no esta instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "Instalalo ejecutando en PowerShell:" -ForegroundColor Yellow
    Write-Host "  powershell -c ""irm bun.sh/install.ps1 | iex""" -ForegroundColor White
    exit 1
}
$bunVersion = bun --version
Write-Host "✓ Bun detectado (v$bunVersion)" -ForegroundColor Green

# 3. Validar prerrequisito: Docker & Docker Compose
Write-Host "`n[2/7] Verificando Docker y Docker Compose..." -ForegroundColor Blue
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[ERROR] 'docker' no esta instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "Por favor instala Docker Desktop para Windows antes de continuar." -ForegroundColor Yellow
    exit 1
}

try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon unreachable"
    }
} catch {
    Write-Host "[ERROR] El servicio de Docker Desktop no parece estar iniciado." -ForegroundColor Red
    Write-Host "Por favor inicia Docker Desktop y vuelve a ejecutar este script." -ForegroundColor Yellow
    exit 1
}

$composeCmd = "docker compose"
try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $composeCmd = "docker-compose"
    }
} catch {
    $composeCmd = "docker-compose"
}
Write-Host "✓ Docker en ejecucion con $composeCmd" -ForegroundColor Green

# 4. Instalar dependencias con Bun
Write-Host "`n[3/7] Instalando dependencias del monorepo con Bun..." -ForegroundColor Blue
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo la instalacion de dependencias con Bun." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencias sincronizadas correctamente." -ForegroundColor Green

# 5. Levantar contenedores de infraestructura
Write-Host "`n[4/7] Iniciando servicios de infraestructura (PostgreSQL 18, Redis, RabbitMQ, ERP Sim, Mailpit)..." -ForegroundColor Blue
if ($composeCmd -eq "docker compose") {
    docker compose -f infra/docker-compose.yml up -d
} else {
    docker-compose -f infra/docker-compose.yml up -d
}

Write-Host "Esperando a que PostgreSQL este listo para aceptar conexiones..." -ForegroundColor Cyan
$maxRetries = 30
$retryCount = 0
$pgReady = $false

while ($retryCount -lt $maxRetries) {
    $null = docker exec mia_crm_postgres pg_isready -U mia_admin -d mia_crm_dev 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pgReady = $true
        break
    }
    $retryCount++
    Start-Sleep -Seconds 1
}

if (-not $pgReady) {
    Write-Host "[ERROR] Tiempo de espera agotado esperando a PostgreSQL." -ForegroundColor Red
    exit 1
}
Write-Host "✓ PostgreSQL listo y aceptando conexiones." -ForegroundColor Green

Write-Host "Esperando a que Redis este listo..." -ForegroundColor Cyan
$retryCount = 0
$redisReady = $false
while ($retryCount -lt 15) {
    $pingResult = docker exec mia_crm_redis redis-cli ping 2>&1
    if ($pingResult -match "PONG") {
        $redisReady = $true
        break
    }
    $retryCount++
    Start-Sleep -Seconds 1
}

if ($redisReady) {
    Write-Host "✓ Redis listo (PONG)." -ForegroundColor Green
} else {
    Write-Host "! Advertencia: Redis tardo en responder, continuando..." -ForegroundColor Yellow
}

# 6. Aplicar migraciones y semillas
Write-Host "`n[5/7] Ejecutando migraciones de base de datos..." -ForegroundColor Blue
bun run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo la ejecucion de migraciones." -ForegroundColor Red
    exit 1
}

if (-not $SkipSeed) {
    Write-Host "`nSembrando datos iniciales y comerciales de prueba..." -ForegroundColor Cyan
    bun run db:seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo la siembra de datos." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Base de datos poblada con datos demo del sector automotriz." -ForegroundColor Green
} else {
    Write-Host "Siembra de datos omitida (-SkipSeed)." -ForegroundColor Yellow
}

# 7. Compilar frontend
Write-Host "`n[6/7] Compilando bundle de Frontend (React + Bun)..." -ForegroundColor Blue
bun run build:web
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo la compilacion del frontend." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Artefactos web compilados en apps/web/dist." -ForegroundColor Green

# 8. Ejecutar pruebas automatizadas
Write-Host "`n[7/7] Verificando suite de pruebas automatizadas..." -ForegroundColor Blue
if (-not $SkipTests) {
    bun test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallaron algunas pruebas automatizadas." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Todas las pruebas pasaron satisfactoriamente." -ForegroundColor Green
} else {
    Write-Host "Pruebas automatizadas omitidas (-SkipTests)." -ForegroundColor Yellow
}

# Resumen de Servicios y Acceso
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Green
Write-Host "       ¡Inicializacion de MIA CRM completada con exito!" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Aplicacion Web & API:      http://localhost:3000" -ForegroundColor White
Write-Host "  Salud y Monitoreo:          http://localhost:3000/health" -ForegroundColor White
Write-Host "  Metricas Prometheus:        http://localhost:3000/metrics" -ForegroundColor White
Write-Host "  RabbitMQ Management:        http://localhost:15672 (user: mia_rabbit / pass: mia_rabbit_password)" -ForegroundColor White
Write-Host "  Mailpit (Mock Emails):      http://localhost:8025" -ForegroundColor White
Write-Host "  PostgreSQL 18 (pgvector):   localhost:5432 (user: mia_admin / db: mia_crm_dev)" -ForegroundColor White
Write-Host "  Simulador ERP DMS (MSSQL):  localhost:1433 (user: sa / pass: Mond4ERP_Password!2026)" -ForegroundColor White
Write-Host ""
Write-Host "Comandos utiles:" -ForegroundColor Cyan
Write-Host "  Iniciar servidor de desarrollo:  bun run dev" -ForegroundColor White
Write-Host "  Ejecutar suite de pruebas:       bun test" -ForegroundColor White
Write-Host "  Asistente onboarding de piloto:  bun run scripts/onboarding-wizard.ts" -ForegroundColor White
Write-Host "  Prueba de carga y concurrencia:  bun run scripts/load-test.ts" -ForegroundColor White
Write-Host "  Detener infraestructura:         docker compose -f infra/docker-compose.yml down" -ForegroundColor White
Write-Host ""

if ($StartServer) {
    Write-Host "Iniciando servidor de desarrollo ahora... (Presiona Ctrl+C para detener)`n" -ForegroundColor Cyan
    bun run dev
}
