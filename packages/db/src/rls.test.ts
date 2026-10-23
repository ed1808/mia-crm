import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from './tenant';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Multi-tenant Row Level Security (RLS) Isolation Test', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenant1Id: string;
  let tenant2Id: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // Creamos dos tenants independientes
    const [t1] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug) VALUES ('Concesionario Los Andes', 'los-andes')
      RETURNING id
    `;
    const [t2] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug) VALUES ('Camiones del Caribe', 'camiones-caribe')
      RETURNING id
    `;

    tenant1Id = t1!.id;
    tenant2Id = t2!.id;
  });

  afterAll(async () => {
    // Limpieza de datos de prueba
    if (adminSql) {
      if (tenant1Id) {
        await adminSql`DELETE FROM tenants WHERE id = ${tenant1Id}::uuid`;
      }
      if (tenant2Id) {
        await adminSql`DELETE FROM tenants WHERE id = ${tenant2Id}::uuid`;
      }
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
  });

  it('Tenant 1 inserts branches and Tenant 2 CANNOT read nor update them under RLS', async () => {
    // 1. Tenant 1 crea una sede en su propio contexto
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      await tx`
        INSERT INTO branches (tenant_id, name, city, address)
        VALUES (${tenant1Id}::uuid, 'Sede Norte Taller', 'Bogotá', 'Autopista Norte # 120')
      `;
    });

    // 2. Tenant 1 consulta sus sedes: debe encontrar 1 sede
    const tenant1Branches = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ name: string }[]>`SELECT name FROM branches`;
    });
    expect(tenant1Branches.length).toBe(1);
    expect(tenant1Branches[0]?.name).toBe('Sede Norte Taller');

    // 3. Tenant 2 consulta sus sedes: DEBE VER CERO SEDES (Aislamiento RLS activo)
    const tenant2Branches = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ name: string }[]>`SELECT name FROM branches`;
    });
    expect(tenant2Branches.length).toBe(0);

    // 4. Tenant 2 intenta hacer UPDATE de registros de Tenant 1
    await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      await tx`UPDATE branches SET name = 'Hackeado por Tenant 2'`;
    });

    // 5. Verificamos que la sede de Tenant 1 sigue intacta con su nombre original
    const verifyT1 = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ name: string }[]>`SELECT name FROM branches`;
    });
    expect(verifyT1.length).toBe(1);
    expect(verifyT1[0]?.name).toBe('Sede Norte Taller');
  });

  it('RLS enforces isolation on App Users across tenants', async () => {
    // Tenant 1 crea un usuario
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      await tx`
        INSERT INTO app_users (tenant_id, email, password_hash, full_name, role)
        VALUES (${tenant1Id}::uuid, 'asesor1@losandes.co', 'hash123', 'Carlos Ruiz', 'sales_advisor')
      `;
    });

    // Tenant 2 intenta listar usuarios y no ve nada
    const usersInTenant2 = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ email: string }[]>`SELECT email FROM app_users`;
    });
    expect(usersInTenant2.length).toBe(0);
  });

  it('RLS enforces isolation on inbox_events across tenants', async () => {
    // Tenant 1 inserta un evento de webhook en su inbox
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      await tx`
        INSERT INTO inbox_events (tenant_id, event_id, source_table, operation, payload)
        VALUES (${tenant1Id}::uuid, 'EVT-001', 'terceros', 'INSERT', '{"nit": "900123456"}'::jsonb)
      `;
    });

    // Tenant 1 lo puede leer
    const t1Events = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ event_id: string }[]>`SELECT event_id FROM inbox_events`;
    });
    expect(t1Events.length).toBe(1);
    expect(t1Events[0]?.event_id).toBe('EVT-001');

    // Tenant 2 NO puede leer el evento de Tenant 1
    const t2Events = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ event_id: string }[]>`SELECT event_id FROM inbox_events`;
    });
    expect(t2Events.length).toBe(0);
  });

  it('RLS enforces isolation on parties and vehicles across tenants', async () => {
    // Tenant 1 inserta una persona y un vehículo
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      const [party] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenant1Id}::uuid, 'person')
        RETURNING id
      `;
      await tx`
        INSERT INTO persons (party_id, tenant_id, first_name, last_name)
        VALUES (${party!.id}::uuid, ${tenant1Id}::uuid, 'Juan', 'Pérez')
      `;
      await tx`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, model_year)
        VALUES (${tenant1Id}::uuid, 'VIN1234567890ABC', 'ABC123', 'Toyota', 'Hilux', 2023)
      `;
    });

    // Tenant 2 intenta consultar parties y vehicles: DEBE VER CERO REGISTROS
    const t2Parties = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM parties`;
    });
    const t2Vehicles = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM vehicles`;
    });

    expect(t2Parties.length).toBe(0);
    expect(t2Vehicles.length).toBe(0);
  });

  it('RLS enforces isolation on work_orders and next_visit_projections across tenants', async () => {
    // Tenant 1 crea una OT y una proyección de mantenimiento
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      const [v] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model)
        VALUES (${tenant1Id}::uuid, 'VIN-MTO-001', 'MTO001', 'Chevrolet', 'NPR')
        RETURNING id
      `;
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenant1Id}::uuid, 'person')
        RETURNING id
      `;

      await tx`
        INSERT INTO work_orders (
          tenant_id, external_id, vehicle_id, party_id,
          order_number, branch_code, order_type, entered_at
        ) VALUES (
          ${tenant1Id}::uuid, 'BOD1_100', ${v!.id}::uuid, ${p!.id}::uuid,
          100, 1, 'maintenance', NOW()
        )
      `;

      await tx`
        INSERT INTO next_visit_projections (
          tenant_id, vehicle_id, projected_date, projected_mileage,
          projection_method, confidence_level, calculation_basis
        ) VALUES (
          ${tenant1Id}::uuid, ${v!.id}::uuid, CURRENT_DATE + 90, 20000,
          'own_history', 'high', '{"avg_days": 90}'::jsonb
        )
      `;
    });

    // Tenant 2 consulta: DEBE VER CERO REGISTROS
    const t2Orders = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM work_orders`;
    });
    const t2Projections = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM next_visit_projections`;
    });

    expect(t2Orders.length).toBe(0);
    expect(t2Projections.length).toBe(0);
  });

  it('RLS enforces isolation on opportunities across tenants', async () => {
    // Tenant 1 crea una oportunidad detectada
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      const [v] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model)
        VALUES (${tenant1Id}::uuid, 'VIN-OPP-001', 'OPP001', 'Toyota', 'Hilux')
        RETURNING id
      `;
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenant1Id}::uuid, 'person')
        RETURNING id
      `;

      await tx`
        INSERT INTO opportunities (
          tenant_id, rule_id, vehicle_id, party_id,
          status, score, evidence
        ) VALUES (
          ${tenant1Id}::uuid, 'R-MNT-01', ${v!.id}::uuid, ${p!.id}::uuid,
          'detected', 85.50, '{"days_left": 15}'::jsonb
        )
      `;
    });

    // Tenant 2 consulta: DEBE VER CERO OPORTUNIDADES
    const t2Opps = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM opportunities`;
    });

    expect(t2Opps.length).toBe(0);
  });

  it('RLS enforces isolation on commercial module (leads, deals, quotes, sales) across tenants', async () => {
    // Tenant 1 crea lead, pipeline, stage, deal, quote y sale
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      const [l] = await tx<{ id: string }[]>`
        INSERT INTO leads (tenant_id, first_name, last_name, phone, source)
        VALUES (${tenant1Id}::uuid, 'Carlos', 'Gómez', '+573001234567', 'meta_lead_ads')
        RETURNING id
      `;
      const [pipe] = await tx<{ id: string }[]>`
        INSERT INTO pipelines (tenant_id, code, name)
        VALUES (${tenant1Id}::uuid, 'nuevos_livianos', 'Nuevos Livianos')
        RETURNING id
      `;
      const [stg] = await tx<{ id: string }[]>`
        INSERT INTO pipeline_stages (tenant_id, pipeline_id, code, name, order_index, probability_pct)
        VALUES (${tenant1Id}::uuid, ${pipe!.id}::uuid, 'contacto', 'Primer Contacto', 1, 20.0)
        RETURNING id
      `;
      const [p] = await tx<{ id: string }[]>`
        INSERT INTO parties (tenant_id, party_type)
        VALUES (${tenant1Id}::uuid, 'person')
        RETURNING id
      `;
      const [d] = await tx<{ id: string }[]>`
        INSERT INTO deals (tenant_id, pipeline_id, stage_id, party_id, title, estimated_value)
        VALUES (${tenant1Id}::uuid, ${pipe!.id}::uuid, ${stg!.id}::uuid, ${p!.id}::uuid, 'Toyota Hilux 4x4', 185000000)
        RETURNING id
      `;
      const [q] = await tx<{ id: string }[]>`
        INSERT INTO quotes (tenant_id, deal_id, quote_number, current_version)
        VALUES (${tenant1Id}::uuid, ${d!.id}::uuid, 'COT-T1-001', 1)
        RETURNING id
      `;
      await tx`
        INSERT INTO quote_versions (tenant_id, quote_id, version_number, base_price, net_amount, valid_until)
        VALUES (${tenant1Id}::uuid, ${q!.id}::uuid, 1, 185000000, 185000000, '2026-11-01')
      `;
    });

    // Tenant 2 consulta: DEBE RETORNAR CERO REGISTROS
    const t2Leads = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM leads`;
    });
    const t2Deals = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM deals`;
    });
    const t2Quotes = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM quotes`;
    });

    expect(t2Leads.length).toBe(0);
    expect(t2Deals.length).toBe(0);
    expect(t2Quotes.length).toBe(0);
  });

  it('RLS enforces isolation on semantic metrics (kpi_definitions) across tenants', async () => {
    // Tenant 1 crea una definición de KPI
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      await tx`
        INSERT INTO kpi_definitions (
          tenant_id, code, name, description, formula, category, unit
        ) VALUES (
          ${tenant1Id}::uuid, 'vehicle_retention_rate', 'Tasa de Retención del Vehículo',
          'Porcentaje del parque atribuible con al menos 1 servicio en los últimos 12 meses',
          '(vehiculos_con_servicio_12m / parque_atribuible_total) * 100',
          'retention', 'percentage'
        )
      `;
    });

    // Tenant 2 consulta: DEBE RETORNAR CERO REGISTROS
    const t2Kpis = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM kpi_definitions`;
    });

    expect(t2Kpis.length).toBe(0);
  });

  it('RLS enforces isolation on AI tool executions, advisor tasks, and internal notes across tenants', async () => {
    // Tenant 1 inserta registros en ai_tool_executions, advisor_tasks y internal_notes
    await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      await tx`
        INSERT INTO ai_tool_executions (
          tenant_id, role, task_type, tool_name, autonomy_level, arguments, result, status
        ) VALUES (
          ${tenant1Id}::uuid, 'service_advisor', 'T3', 'explain_metric', 0,
          '{"metric": "vehicle_retention_rate"}'::jsonb, '{"explanation": "ok"}'::jsonb, 'executed'
        )
      `;
      await tx`
        INSERT INTO advisor_tasks (
          tenant_id, title, description, entity_type, entity_id
        ) VALUES (
          ${tenant1Id}::uuid, 'Llamar cliente AAA123', 'Mantenimiento preventivo 20k', 'vehicle', 'AAA123'
        )
      `;
      await tx`
        INSERT INTO internal_notes (
          tenant_id, entity_type, entity_id, content
        ) VALUES (
          ${tenant1Id}::uuid, 'vehicle', 'AAA123', 'Cliente prefiere citas en la mañana'
        )
      `;
    });

    // Tenant 1 verifica que existen sus registros
    const t1Ai = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM ai_tool_executions`;
    });
    const t1Tasks = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM advisor_tasks`;
    });
    const t1Notes = await withTenant(appSql, { tenantId: tenant1Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM internal_notes`;
    });

    expect(t1Ai.length).toBe(1);
    expect(t1Tasks.length).toBe(1);
    expect(t1Notes.length).toBe(1);

    // Tenant 2 consulta: DEBE VER CERO REGISTROS (Aislamiento RLS estricto)
    const t2Ai = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM ai_tool_executions`;
    });
    const t2Tasks = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM advisor_tasks`;
    });
    const t2Notes = await withTenant(appSql, { tenantId: tenant2Id }, async (tx) => {
      return await tx<{ id: string }[]>`SELECT id FROM internal_notes`;
    });

    expect(t2Ai.length).toBe(0);
    expect(t2Tasks.length).toBe(0);
    expect(t2Notes.length).toBe(0);
  });
});

