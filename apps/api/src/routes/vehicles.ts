import { Hono } from 'hono';
import { withTenant } from '@mia-crm/db';
import { tenantMiddleware } from '../middleware/tenant';

export function createVehiclesRouter() {
  const router = new Hono();

  router.use('*', tenantMiddleware);

  // GET /api/v1/vehicles — Listado y búsqueda de vehículos
  router.get('/', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');

    const search = c.req.query('search')?.trim() ?? '';
    const vehicleType = c.req.query('vehicleType')?.trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const offset = Number(c.req.query('offset') ?? 0);

    const result = await withTenant(db, { tenantId }, async (tx) => {
      const searchPattern = search ? `%${search}%` : null;

      const rows = await tx<
        {
          id: string;
          vin: string | null;
          current_plate: string | null;
          make: string;
          model: string;
          model_year: number | null;
          vehicle_type: string;
          current_mileage: number | null;
          current_operating_hours: number | null;
          warranty_end_date: string | null;
          rtm_due_date: string | null;
          created_at: string;
          // Propietario primario
          owner_party_id: string | null;
          owner_name: string | null;
          owner_id_number: string | null;
          owner_is_company: boolean | null;
          // Proyección de próxima visita
          projected_date: string | null;
          projected_mileage: number | null;
          projection_method: string | null;
          confidence_level: string | null;
          // Oportunidades activas
          active_opportunities_count: string;
        }[]
      >`
        SELECT
          v.id,
          v.vin,
          v.current_plate,
          v.make,
          v.model,
          v.model_year,
          v.vehicle_type,
          v.current_mileage,
          v.current_operating_hours,
          v.warranty_end_date::text,
          v.rtm_due_date::text,
          v.created_at::text,
          -- Propietario primario
          vr.party_id as owner_party_id,
          COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), comp.legal_name) as owner_name,
          pi.id_number as owner_id_number,
          (comp.party_id IS NOT NULL) as owner_is_company,
          -- Proyección
          nvp.projected_date::text,
          nvp.projected_mileage,
          nvp.projection_method,
          nvp.confidence_level,
          -- Conteo de oportunidades activas
          (
            SELECT count(*)::text
            FROM opportunities opp
            WHERE opp.vehicle_id = v.id
              AND opp.status IN ('detected', 'in_progress', 'appointment_requested')
          ) as active_opportunities_count
        FROM vehicles v
        LEFT JOIN vehicle_relationships vr
          ON vr.vehicle_id = v.id AND vr.role = 'owner' AND vr.is_primary = true AND vr.valid_to IS NULL
        LEFT JOIN persons p ON p.party_id = vr.party_id
        LEFT JOIN companies comp ON comp.party_id = vr.party_id
        LEFT JOIN party_identifiers pi ON pi.party_id = vr.party_id
        LEFT JOIN next_visit_projections nvp ON nvp.vehicle_id = v.id
        WHERE (${searchPattern}::text IS NULL OR
               v.current_plate ILIKE ${searchPattern} OR
               v.vin ILIKE ${searchPattern} OR
               v.make ILIKE ${searchPattern} OR
               v.model ILIKE ${searchPattern} OR
               p.first_name ILIKE ${searchPattern} OR
               comp.legal_name ILIKE ${searchPattern})
          AND (${vehicleType ?? null}::varchar IS NULL OR v.vehicle_type = ${vehicleType})
        ORDER BY v.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return rows;
    });

    return c.json({ data: result, count: result.length, limit, offset });
  });

  // GET /api/v1/vehicles/:id — Vehicle 360 Completo
  router.get('/:id', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const vehicleId = c.req.param('id');

    const result = await withTenant(db, { tenantId }, async (tx) => {
      // 1. Datos básicos del vehículo
      const vehicleRows = await tx<
        {
          id: string;
          vin: string | null;
          current_plate: string | null;
          make: string;
          model: string;
          model_year: number | null;
          vehicle_type: string;
          current_mileage: number | null;
          current_operating_hours: number | null;
          warranty_end_date: string | null;
          rtm_due_date: string | null;
          created_at: string;
          updated_at: string;
        }[]
      >`
        SELECT
          id, vin, current_plate, make, model, model_year,
          vehicle_type, current_mileage, current_operating_hours,
          warranty_end_date::text, rtm_due_date::text,
          created_at::text, updated_at::text
        FROM vehicles
        WHERE id = ${vehicleId}::uuid
        LIMIT 1
      `;

      const vehicle = vehicleRows[0];
      if (!vehicle) return null;

      // 2. Historial de placas
      const plates = await tx<
        {
          plate: string;
          valid_from: string;
          valid_to: string | null;
          is_active: boolean;
        }[]
      >`
        SELECT plate, valid_from::text, valid_to::text, (valid_to IS NULL) as is_active
        FROM plate_history
        WHERE vehicle_id = ${vehicleId}::uuid
        ORDER BY valid_from DESC
      `;

      // 3. Historial de relaciones de propiedad / titulares
      const relationships = await tx<
        {
          id: string;
          party_id: string;
          role: string;
          is_primary: boolean;
          share_pct: number;
          valid_from: string;
          valid_to: string | null;
          source: string;
          party_name: string;
          id_number: string | null;
          id_type: string | null;
          phone: string | null;
          email: string | null;
          is_company: boolean;
        }[]
      >`
        SELECT
          vr.id,
          vr.party_id,
          vr.role,
          vr.is_primary,
          vr.share_percentage as share_pct,
          vr.valid_from::text,
          vr.valid_to::text,
          COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), comp.legal_name, 'Sin nombre') as party_name,
          pi.id_number,
          pi.id_type,
          cp_phone.value as phone,
          cp_email.value as email,
          (comp.party_id IS NOT NULL) as is_company
        FROM vehicle_relationships vr
        LEFT JOIN persons p ON p.party_id = vr.party_id
        LEFT JOIN companies comp ON comp.party_id = vr.party_id
        LEFT JOIN party_identifiers pi ON pi.party_id = vr.party_id
        LEFT JOIN party_contact_points cp_phone ON cp_phone.party_id = vr.party_id AND cp_phone.channel = 'phone' AND cp_phone.is_primary = true
        LEFT JOIN party_contact_points cp_email ON cp_email.party_id = vr.party_id AND cp_email.channel = 'email' AND cp_email.is_primary = true
        WHERE vr.vehicle_id = ${vehicleId}::uuid
        ORDER BY vr.valid_from DESC
      `;

      // 4. Lecturas de odómetro / horómetro
      const usageReadings = await tx<
        {
          id: string;
          mileage: number | null;
          operating_hours: number | null;
          reading_date: string;
          source: string;
          is_anomaly: boolean;
        }[]
      >`
        SELECT id, mileage, operating_hours, reading_date::text, source, is_anomaly
        FROM usage_readings
        WHERE vehicle_id = ${vehicleId}::uuid
        ORDER BY reading_date DESC
        LIMIT 20
      `;

      // 5. Historial de órdenes de trabajo (Posventa)
      const workOrders = await tx<
        {
          id: string;
          external_id: string;
          order_number: number;
          order_type: string;
          status: string;
          mileage: number | null;
          operating_hours: number | null;
          entered_at: string;
          promised_delivery_at: string | null;
          is_billed: boolean;
        }[]
      >`
        SELECT
          id, external_id, order_number, order_type, status,
          mileage, operating_hours, entered_at::text, promised_delivery_at::text, is_billed
        FROM work_orders
        WHERE vehicle_id = ${vehicleId}::uuid
        ORDER BY entered_at DESC
      `;

      // 6. Proyección de próxima visita
      const projectionRows = await tx<
        {
          id: string;
          projected_date: string;
          projected_mileage: number | null;
          projection_method: string;
          confidence_level: string;
          calculation_basis: Record<string, unknown>;
          calculated_at: string;
        }[]
      >`
        SELECT
          id, projected_date::text, projected_mileage,
          projection_method, confidence_level, calculation_basis, calculated_at::text
        FROM next_visit_projections
        WHERE vehicle_id = ${vehicleId}::uuid
        LIMIT 1
      `;

      // 7. Oportunidades del vehículo
      const opportunities = await tx<
        {
          id: string;
          rule_id: string;
          rule_version: number;
          status: string;
          score: number;
          value_estimate: number | null;
          evidence: Record<string, unknown>;
          is_control_group: boolean;
          expires_at: string | null;
          created_at: string;
        }[]
      >`
        SELECT
          id, rule_id, rule_version, status, score,
          value_estimate, evidence, is_control_group,
          expires_at::text, created_at::text
        FROM opportunities
        WHERE vehicle_id = ${vehicleId}::uuid
        ORDER BY created_at DESC
      `;

      return {
        vehicle,
        plates,
        ownership: {
          currentPrimaryOwner: relationships.find((r) => r.role === 'owner' && r.is_primary && !r.valid_to) ?? null,
          history: relationships,
        },
        usageReadings,
        workOrders,
        projection: projectionRows[0] ?? null,
        opportunities,
      };
    });

    if (!result) {
      return c.json({ error: 'NOT_FOUND', message: 'Vehículo no encontrado.' }, 404);
    }

    return c.json({ data: result });
  });

  return router;
}
