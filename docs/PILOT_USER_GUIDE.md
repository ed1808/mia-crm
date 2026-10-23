# MIA CRM — Manual del Usuario para el Piloto Operativo
**Hito M8: Preparación del Piloto de Concesionario**
*Guía de Uso para Asesores Comerciales, Asesores de Servicio y Directores Gerenciales*

---

## 1. Introducción y Acceso al Sistema

MIA CRM es la plataforma de inteligencia artificial especializada en el sector automotriz colombiano. Asiste en tiempo real a los equipos de venta y posventa para maximizar la retención de clientes, cumplir SLAs críticos y gobernar indicadores sin cifras inventadas.

- **Acceso Web:** [http://localhost:3000](http://localhost:3000)
- **Credenciales por Defecto del Piloto:**
  - **Director / Gerente:** `gerencia@andinamotors.com.co` / `PilotoMIA2026!`
  - **Asesor Comercial:** `ventas@andinamotors.com.co` / `PilotoMIA2026!`
  - **Asesor de Servicio:** `taller@andinamotors.com.co` / `PilotoMIA2026!`
  - **Tenant Demo Colombia:** Selector rápido en encabezado superior.

---

## 2. Guía por Rol Operativo

### 2.1 💼 Rol: Asesor Comercial (Ventas & Leads)

#### Objetivo Principal
Contactar leads antes del vencimiento de su SLA (< 15 minutos), gestionar cotizaciones formales con retoma de usados y cerrar ventas conciliadas con el ERP.

#### Flujo de Trabajo Diario:
1. **Bandeja de Leads Inbound:**
   - Visualiza en la pestaña **Comercial** los leads capturados por formularios web, Meta Lead Ads o showroom.
   - Observa el semáforo de SLA:
     - 🟢 **En tiempo:** Tiempo restante holgado.
     - 🟡 **Crítico (SLA < 15 min):** Debe contactarse de inmediato.
     - 🔴 **Vencido:** Alerta de pérdida de conversión.
2. **Iniciar Contacto por WhatsApp:**
   - Haz clic en **"Iniciar Contacto"** en la tarjeta del lead.
   - Selecciona el canal WhatsApp para generar el enlace oficial `wa.me/57...` con mensaje pre-redactado.
3. **Conversión a Oportunidad en Embudo (Deal):**
   - Haz clic en **"Convertir a Oportunidad"** seleccionando el pipeline (ej. *Vehículos Nuevos* o *Comerciales/Pesados B2B*).
4. **Cotización Formal y Retoma de Usados:**
   - Abre la oportunidad y haz clic en **"Crear Cotización"**.
   - Agrega ítems (ej. versión del vehículo, accesorios, matrícula).
   - Si el cliente entrega un vehículo usado en parte de pago, ingresa el **Valor de Retoma**; el sistema recalculará automáticamente el monto neto a financiar.
5. **Conciliación de Venta con ERP:**
   - Cuando el ERP emite la factura y pedido (`vh_documentos_ped`), MIA CRM concilia el negocio, actualiza la oportunidad a `won` (Ganada) y vincula al nuevo propietario con su garantía y plan de mantenimiento.

---

### 2.2 🔧 Rol: Asesor de Servicio (Posventa & Taller)

#### Objetivo Principal
Anticipar las necesidades de mantenimiento preventivo de los clientes, proyectar ingresos futuros al taller y agendar citas efectivas.

#### Flujo de Trabajo Diario:
1. **Módulo "Mi Día" (Oportunidades Predictivas):**
   - Revisa las oportunidades priorizadas generadas por el motor predictivo:
     - **R-MNT-01:** Mantenimiento preventivo próximo (15 días antes).
     - **R-MNT-02:** Mantenimiento preventivo vencido (> 7 días de atraso).
     - **R-WAR-01:** Vencimiento próximo de garantía comercial (60 días antes).
     - **R-RET-01:** Vehículo desatendido con riesgo de deserción a taller independiente.
     - **R-FLT-01:** Flota con 3 o más unidades pendientes de servicio.
     - **R-RTM-01:** Revisión Técnico-Mecánica obligatoria por vencer (D-47).
2. **Consulta Vehicle 360:**
   - Ingresa cualquier placa colombiana (ej. `ABC123` o `MED345`).
   - Revisa la placa reflectiva, odómetro actual, historial de órdenes de trabajo (OT), titular registrado y **proyección de próxima visita (D-35)**.
3. **Agendamiento de Cita en Taller:**
   - Haz clic en **"Agendar Cita Taller"**.
   - Selecciona fecha sugerida y tipo de servicio (Preventivo, Garantía, Frenos/Suspensión).
   - El sistema registra la solicitud y notifica al cliente con confirmación de horario.

---

### 2.3 📊 Rol: Director General / Gerente (Gobernanza & KPIs)

#### Objetivo Principal
Monitorear el rendimiento global del concesionario con **Cero Cifras Inventadas** bajo la Capa Semántica gobernada por PostgreSQL RLS (Decisión D-16).

#### Tablero de Indicadores Clave:
1. **Tasa de Retención del Vehículo (D-13):**
   - Porcentaje del parque automotriz activo que asistió al taller en los últimos 12 meses.
   - Desglose interactivo por marca (Kenworth, Chevrolet, Mazda, Foton) y sede.
2. **Lift Incremental del Grupo de Control (15% - D-39):**
   - Compara el retorno de vehículos intervenidos por MIA CRM frente al 15% de control no contactado.
   - Demuestra el impacto económico atribuible neto generado por la plataforma.
3. **Cumplimiento de SLA en Primer Contacto:**
   - Porcentaje de leads comerciales atendidos en menos de 15 minutos.

---

## 3. Uso del Copiloto Inteligente MIA

El copiloto está disponible en todo momento haciendo clic en el botón superior **"Copiloto MIA"** o en el botón flotante en la esquina inferior derecha.

### Acciones Recomendadas por Rol:
- **Asesor Comercial:**
  - *"¿Qué hago hoy con mis leads y cuáles tienen SLA en riesgo?"*
  - *"Consulta el estado 360 del vehículo con placa ABC123"*
  - *"Redacta un mensaje de WhatsApp para seguimiento de cotización"*
  - *"Crea una tarea para hacer seguimiento a la cotización mañana"*
- **Asesor de Servicio:**
  - *"¿Qué vehículos deben ingresar al taller esta semana?"*
  - *"Consulta el estado de mantenimiento y odómetro para la placa MED345"*
  - *"Prepara una propuesta de cita para el vehículo con placa ABC123"*
- **Gerente General:**
  - *"¿Cómo está la tasa de retención de vehículos desglosada por marca?"*
  - *"Explica la fórmula matemática del KPI vehicle_retention_rate"*
  - *"¿Cuál es el lift del grupo de control del 15%?"*

### Niveles de Autonomía de la IA (Decisión D-15):
- 🟢 **Nivel 0 (Solo Lectura):** Consultas de fichas 360, leads e indicadores. Se ejecutan al instante.
- 🔵 **Nivel 1 (Escritura Reversible):** Creación de tareas y recordatorios personales en tu bandeja.
- 🟡 **Nivel 2 (Requiere Aprobación Humana):** Redacción de mensajes al cliente o solicitudes de citas. La IA te presenta la propuesta con vista previa para que apruebes el envío con un clic.
- 🔴 **Nivel 3 (Prohibido):** Borrado de bases de datos o modificaciones sin trazabilidad. Bloqueadas por diseño.
