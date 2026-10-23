// scripts/onboarding-wizard.ts
// Asistente de Onboarding Automatizado para Concesionarios Piloto (Hito M8: Preparación del piloto)
// Basado en Decisiones D-01 a D-50

import { SQL } from 'bun';
import { withTenant } from '../packages/db/src';
import { BunSqlMetricsRepository, ListKpiDefinitionsUseCase } from '../packages/modules/metrics/src';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';

export interface OnboardingConfig {
  dealershipName: string;
  dealershipSlug: string;
  adminEmail: string;
  salesEmail: string;
  serviceEmail: string;
  initialPassword?: string;
  branches: { name: string; city: string; address: string }[];
}

export async function runOnboarding(config: OnboardingConfig) {
  const sql = new SQL(ADMIN_DATABASE_URL);
  const passwordToHash = config.initialPassword || 'PilotoMIA2026!';

  console.log(`================================================================`);
  console.log(` 🚀 MIA CRM — Asistente de Onboarding de Concesionario Piloto`);
  console.log(` Concesionario: ${config.dealershipName} (${config.dealershipSlug})`);
  console.log(` Fecha: ${new Date().toISOString()}`);
  console.log(`================================================================`);

  try {
    // 1. Crear o recuperar Tenant
    let [tenant] = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM tenants WHERE slug = ${config.dealershipSlug} LIMIT 1
    `;

    if (!tenant) {
      const [created] = await sql<{ id: string; name: string }[]>`
        INSERT INTO tenants (name, slug)
        VALUES (${config.dealershipName}, ${config.dealershipSlug})
        RETURNING id, name
      `;
      tenant = created;
      console.log(`✅ Tenant creado: ID ${tenant.id}`);
    } else {
      console.log(`ℹ️ Tenant existente reutilizado: ID ${tenant.id}`);
    }

    const tenantId = tenant.id;

    // 2. Provisionar sedes, usuarios y reglas bajo RLS
    await withTenant(sql, { tenantId }, async (tx) => {
      // A. Sedes (Branches)
      console.log(`📍 Configurando sedes operativas...`);
      for (const b of config.branches) {
        await tx`
          INSERT INTO branches (tenant_id, name, city, address)
          VALUES (${tenantId}::uuid, ${b.name}, ${b.city}, ${b.address})
          ON CONFLICT DO NOTHING
        `;
      }

      const branchList = await tx<{ id: string; name: string }[]>`
        SELECT id, name FROM branches WHERE tenant_id = ${tenantId}::uuid
      `;
      const primaryBranchId = branchList[0]?.id;

      // B. Usuarios del Piloto con contraseñas seguras argon2id (D-40)
      console.log(`👤 Provisionando usuarios de roles del piloto (D-14)...`);
      const passwordHash = await Bun.password.hash(passwordToHash, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 2,
      });

      const pilotUsers = [
        {
          email: config.adminEmail,
          fullName: 'Director General Piloto',
          role: 'executive_manager',
        },
        {
          email: config.salesEmail,
          fullName: 'Asesor Comercial Piloto',
          role: 'sales_advisor',
        },
        {
          email: config.serviceEmail,
          fullName: 'Jefe de Taller / Servicio Piloto',
          role: 'service_advisor',
        },
      ];

      for (const u of pilotUsers) {
        await tx`
          INSERT INTO app_users (tenant_id, email, password_hash, full_name, role, is_active)
          VALUES (
            ${tenantId}::uuid,
            ${u.email},
            ${passwordHash},
            ${u.fullName},
            ${u.role},
            true
          )
          ON CONFLICT (tenant_id, email) DO UPDATE
          SET full_name = EXCLUDED.full_name,
              role = EXCLUDED.role,
              is_active = true
        `;
      }

      // C. Conector de ERP con Clave de API
      console.log(`🔌 Configurando conector de ingesta ERP...`);
      const rawApiKey = `erp-${config.dealershipSlug}-key-${crypto.randomUUID().slice(0, 8)}`;
      const hasher = new Bun.CryptoHasher('sha256');
      hasher.update(rawApiKey);
      const apiKeyHash = hasher.digest('hex');

      await tx`
        INSERT INTO connectors (tenant_id, name, type, api_key_hash, is_active)
        VALUES (${tenantId}::uuid, 'Conector ERP Primario', 'erp_sql_server', ${apiKeyHash}, true)
        ON CONFLICT DO NOTHING
      `;

      // D. Catálogo de Métricas Gobernadas (D-16)
      console.log(`📊 Inicializando capa semántica de KPIs automotrices gobernados...`);
      const metricsRepo = new BunSqlMetricsRepository(tx);
      const listKpis = new ListKpiDefinitionsUseCase(metricsRepo);
      const kpisResult = await listKpis.execute();
      console.log(`   ${kpisResult.length} KPIs oficiales gobernados activos.`);

      // E. Parámetros de Reglas de Oportunidades (D-37, D-38, D-39)
      console.log(`⚙️ Estableciendo parámetros de motor de oportunidades y grupo de control (15%)...`);
      const defaultRules = [
        {
          ruleId: 'R-MNT-01',
          name: 'Mantenimiento Preventivo Próximo',
          params: { daysBefore: 15, minMileageThreshold: 5000 },
        },
        {
          ruleId: 'R-MNT-02',
          name: 'Mantenimiento Preventivo Vencido',
          params: { daysOverdueTrigger: 7, maxDaysOverdueExpiry: 60 },
        },
        {
          ruleId: 'R-WAR-01',
          name: 'Vencimiento Próximo de Garantía',
          params: { daysBeforeWarrantyEnd: 60 },
        },
        {
          ruleId: 'R-RET-01',
          name: 'Renovación Comercial / Vehículo Desatendido',
          params: { minDaysSinceLastService: 180, multiplierInterval: 2.0 },
        },
        {
          ruleId: 'R-FLT-01',
          name: 'Consolidación de Flotas',
          params: { minDueUnits: 3 },
        },
        {
          ruleId: 'R-RTM-01',
          name: 'Revisión Técnico-Mecánica Obligatoria (D-47)',
          params: { daysBeforeStatutoryRtm: 30 },
        },
      ];

      for (const r of defaultRules) {
        await tx`
          INSERT INTO rule_params (tenant_id, rule_id, version, params)
          VALUES (${tenantId}::uuid, ${r.ruleId}, 1, ${JSON.stringify(r.params)}::jsonb)
          ON CONFLICT (tenant_id, rule_id, version) DO UPDATE
          SET params = EXCLUDED.params
        `;
      }

      // F. Pipelines Comerciales por Defecto (D-09)
      console.log(`🚗 Verificando pipelines automotrices (Nuevos, Usados, Pesados B2B, Posventa)...`);
      const existingPipelines = await tx<{ count: string }[]>`
        SELECT count(*)::text as count FROM pipelines WHERE tenant_id = ${tenantId}::uuid
      `;

      if (Number(existingPipelines[0]?.count || 0) === 0) {
        const defaultPipelines = [
          {
            code: 'new_vehicles',
            name: 'Venta de Vehículos Nuevos',
            isDefault: true,
            stages: [
              { code: 'lead_inbound', name: 'Lead Inbound', orderIndex: 1, probability: 10 },
              { code: 'contacted', name: 'Contactado / Perfilado', orderIndex: 2, probability: 25 },
              { code: 'test_drive', name: 'Test Drive / Demo', orderIndex: 3, probability: 50 },
              { code: 'negotiation', name: 'Negociación / Cotización', orderIndex: 4, probability: 75 },
              { code: 'won', name: 'Venta Ganada (Facturado ERP)', orderIndex: 5, probability: 100, isWon: true },
              { code: 'lost', name: 'Oportunidad Perdida', orderIndex: 6, probability: 0, isLost: true },
            ],
          },
          {
            code: 'aftersales_service',
            name: 'Retención Posventa y Taller',
            isDefault: false,
            stages: [
              { code: 'opp_detected', name: 'Oportunidad Detectada', orderIndex: 1, probability: 20 },
              { code: 'contact_initiated', name: 'Contacto Iniciado (wa.me)', orderIndex: 2, probability: 40 },
              { code: 'appointment_booked', name: 'Cita Agendada Taller', orderIndex: 3, probability: 70 },
              { code: 'ot_opened', name: 'OT Abierta en ERP', orderIndex: 4, probability: 90 },
              { code: 'serviced', name: 'Servicio Facturado (Retención)', orderIndex: 5, probability: 100, isWon: true },
              { code: 'rejected', name: 'Rechazado / Cooldown 45d', orderIndex: 6, probability: 0, isLost: true },
            ],
          },
        ];

        for (const p of defaultPipelines) {
          const [createdPipe] = await tx<{ id: string }[]>`
            INSERT INTO pipelines (tenant_id, code, name, is_default)
            VALUES (${tenantId}::uuid, ${p.code}, ${p.name}, ${p.isDefault})
            RETURNING id
          `;
          for (const s of p.stages) {
            await tx`
              INSERT INTO pipeline_stages (tenant_id, pipeline_id, code, name, order_index, probability_pct, is_won, is_lost)
              VALUES (
                ${tenantId}::uuid,
                ${createdPipe.id}::uuid,
                ${s.code},
                ${s.name},
                ${s.orderIndex},
                ${s.probability},
                ${s.isWon || false},
                ${s.isLost || false}
              )
            `;
          }
        }
      }

      console.log(`================================================================`);
      console.log(`🎉 ¡Onboarding completado con éxito para '${config.dealershipName}'!`);
      console.log(`   Tenant ID:        ${tenantId}`);
      console.log(`   Clave ERP Demo:   ${rawApiKey}`);
      console.log(`   Usuario Admin:    ${config.adminEmail}`);
      console.log(`   Contraseña Temp:  ${passwordToHash}`);
      console.log(`================================================================`);
    });

    return { tenantId, slug: config.dealershipSlug };
  } finally {
    await sql.close();
  }
}

// Ejecución directa si se invoca desde CLI
if (import.meta.main) {
  const sampleConfig: OnboardingConfig = {
    dealershipName: process.env.DEALER_NAME || 'Andina Motors Colombia SAS',
    dealershipSlug: process.env.DEALER_SLUG || 'andina-motors',
    adminEmail: process.env.ADMIN_EMAIL || 'gerencia@andinamotors.com.co',
    salesEmail: process.env.SALES_EMAIL || 'ventas@andinamotors.com.co',
    serviceEmail: process.env.SERVICE_EMAIL || 'taller@andinamotors.com.co',
    branches: [
      {
        name: 'Sede Principal Calle 127',
        city: 'Bogotá',
        address: 'Calle 127 # 19-45',
      },
      {
        name: 'Centro de Carga y Pesados Fontibón',
        city: 'Bogotá / Fontibón',
        address: 'Avenida Centenario # 105-20',
      },
      {
        name: 'Sede El Poblado',
        city: 'Medellín',
        address: 'Carrera 43A # 15 Sur - 80',
      },
    ],
  };

  runOnboarding(sampleConfig)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error durante el onboarding:', err);
      process.exit(1);
    });
}
