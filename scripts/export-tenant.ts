#!/usr/bin/env bun
// scripts/export-tenant.ts
// Exportación selectiva de datos por tenant para portabilidad y cumplimiento Ley 1581 (Decisión D-31)

import { SQL } from 'bun';
import { withTenant } from '../packages/db/src';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL =
  process.env.APP_DATABASE_URL ||
  'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

async function main() {
  const args = process.argv.slice(2);
  const tenantSlug = args[0] || 'demo-colombia';

  console.log(`====================================================`);
  console.log(` MIA CRM — Exportación de Datos de Tenant (Ley 1581)`);
  console.log(` Tenant objetivo: '${tenantSlug}'`);
  console.log(`====================================================`);

  const adminSql = new SQL(ADMIN_DATABASE_URL);
  const appSql = new SQL(APP_DATABASE_URL);

  try {
    // 1. Obtener tenant
    const tenants = await adminSql<{ id: string; name: string; slug: string; created_at: Date }[]>`
      SELECT id, name, slug, created_at FROM tenants WHERE slug = ${tenantSlug} OR id::text = ${tenantSlug}
    `;

    if (!tenants[0]) {
      console.error(`❌ Error: Tenant '${tenantSlug}' no encontrado.`);
      process.exit(1);
    }

    const tenant = tenants[0];
    const tenantId = tenant.id;

    console.log(`📦 Exportando datos para: ${tenant.name} (${tenant.id}) bajo RLS...`);

    // 2. Extraer datos bajo withTenant para garantizar aislamiento
    const exportData = await withTenant(appSql, { tenantId }, async (tx) => {
      const branches = await tx`SELECT * FROM branches`;
      const users = await tx`SELECT id, email, full_name, role, is_active FROM app_users`;
      const parties = await tx`
        SELECT p.id, p.party_type, per.first_name, per.last_name, comp.legal_name, comp.trade_name
        FROM parties p
        LEFT JOIN persons per ON per.party_id = p.id
        LEFT JOIN companies comp ON comp.party_id = p.id
      `;
      const vehicles = await tx`
        SELECT id, vin, current_plate, make, model, model_year, vehicle_type, current_mileage
        FROM vehicles
      `;
      const workOrders = await tx`
        SELECT id, external_id, order_number, order_type, status, mileage, entered_at
        FROM work_orders
      `;
      const opportunities = await tx`
        SELECT id, rule_id, status, score, value_estimate, is_control_group, created_at
        FROM opportunities
      `;
      const leads = await tx`
        SELECT id, first_name, last_name, phone, email, source, status, interested_vehicle_model
        FROM leads
      `;
      const deals = await tx`
        SELECT d.id, d.title, d.estimated_value, d.status, d.created_at,
               COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), c.legal_name, 'Cliente') as customer_name
        FROM deals d
        LEFT JOIN parties party ON d.party_id = party.id
        LEFT JOIN persons p ON party.id = p.party_id
        LEFT JOIN companies c ON party.id = c.party_id
      `;

      return {
        tenant,
        exportedAt: new Date().toISOString(),
        counts: {
          branches: branches.length,
          users: users.length,
          parties: parties.length,
          vehicles: vehicles.length,
          workOrders: workOrders.length,
          opportunities: opportunities.length,
          leads: leads.length,
          deals: deals.length,
        },
        data: {
          branches,
          users,
          parties,
          vehicles,
          workOrders,
          opportunities,
          leads,
          deals,
        },
      };
    });

    const exportPath = `./backups/tenant_export_${tenant.slug}_${Date.now()}.json`;
    await Bun.write(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`✅ Exportación generada exitosamente en: ${exportPath}`);
    console.log(`📊 Resumen de registros exportados:`, exportData.counts);
    console.log(`====================================================`);
  } finally {
    await adminSql.close();
    await appSql.close();
  }
}

main().catch((err) => {
  console.error('Error fatal durante la exportación:', err);
  process.exit(1);
});
