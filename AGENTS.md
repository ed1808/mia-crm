# Instrucciones de Desarrollo y Reglas de Codificación — MIA CRM

Este documento sintetiza las reglas fundamentales que todo desarrollador y agente debe seguir al trabajar en esta base de código, según lo acordado en la definición de producto y arquitectura (Decisiones D-01 a D-50).

## 1. Stack Tecnológico Exclusivo
- **Runtime & Toolchain:** Bun exclusivamente (`bun install`, `bun run`, `bun test`, `bun build`). No utilizar Node, npm, yarn ni Vite.
- **Backend:** Bun + Hono. Consultas SQL mediante `Bun.sql` directo (sin ORMs pesados).
- **Frontend:** React empaquetado y servido nativamente con Bun (`Bun.serve` en dev, `bun build` para producción).
- **Base de Datos:** PostgreSQL 18 con Row-Level Security (RLS) mandatorio por `tenant_id` y extensión `pgvector`.
- **Mensajería:** RabbitMQ (patrón Outbox transaccional para eventos de dominio).
- **Caché & Locks:** Redis.

## 2. Principios de Diseño y Arquitectura (Clean Architecture + SOLID)
Cada bounded context en `packages/modules/<modulo>/` se divide estrictamente en 4 capas concéntricas:
1. `domain/`: Entidades, Value Objects (VO), Reglas de negocio, Eventos de dominio, Puertos (interfaces). CERO dependencias externas o de frameworks.
2. `application/`: Casos de uso (Commands/Queries + Handlers), DTOs, Puertos de salida.
3. `infrastructure/`: Implementaciones concretas de repositorios (`Bun.sql`), adaptadores externos, publishers de eventos.
4. `index.ts`: Única API pública exportada hacia otros módulos.

### Regla de Dependencia
El flujo de dependencia siempre apunta hacia adentro: `Interface -> Infrastructure/Application -> Domain`.
Cualquier importación que viole este flujo romperá la validación de CI.

## 3. Clean Code & Buenas Prácticas
- **Nombres en inglés:** El código, entidades, funciones y variables se escriben en inglés técnico automotriz (`Vehicle`, `WorkOrder`, `Plate`, `Party`, `Deal`).
- **Textos de UI en español:** Textos dirigidos al usuario final y etiquetas de dominio local se muestran en español de Colombia.
- **Value Objects contra la Obsesión por Primitivos:** Tipos como `Plate`, `Vin`, `Nit`, `Money`, `Mileage` deben modelarse como objetos inmutables con validación de fábrica.
- **Manejo de Errores Tipado:** Errores de negocio esperados retornan `Result<T, DomainError>`. Las excepciones se reservan para fallos catastróficos o de infraestructura.
- **Cero números o cadenas mágicas:** Parámetros configurables y umbrales deben provenir de parámetros de reglas o configuración inyectada.
- **Tiempo inyectable:** Se debe utilizar siempre una abstracción de reloj (`Clock`) en lugar de invocar directamente `Date.now()` o `new Date()`.

## 4. Multi-tenancy & Seguridad
- Toda tabla de negocio debe incluir `tenant_id` y tener habilitado RLS (`FORCE ROW LEVEL SECURITY`).
- Toda operación de base de datos debe ejecutarse en el contexto de `withTenant(ctx, tx)`.
- Todo cambio que agregue una nueva tabla debe incluir su prueba unitaria/integración de aislamiento multitenant.
