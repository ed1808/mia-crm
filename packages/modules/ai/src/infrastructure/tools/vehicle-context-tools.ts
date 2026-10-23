// packages/modules/ai/src/infrastructure/tools/vehicle-context-tools.ts
import type { SQL } from 'bun';
import { Result } from '@mia-crm/kernel';
import { withTenant } from '@mia-crm/db';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';

export class GetVehicle360Tool implements IAiTool {
  readonly name = 'get_vehicle_360';
  readonly description =
    'Obtiene la ficha Vehicle 360 integral de un vehículo por placa o VIN: especificaciones, odómetro/horómetro, propietario primario, proyección de mantenimiento y oportunidades activas.';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'plate',
      type: 'string',
      description: 'Placa del vehículo en Colombia (ej. ABC123 o TTM456)',
      required: false,
    },
    {
      name: 'vin',
      type: 'string',
      description: 'Número de Identificación Vehicular (17 caracteres)',
      required: false,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(
    ctx: ToolExecutionContext,
    params: { plate?: string; vin?: string },
  ): Promise<Result<any, any>> {
    if (!params.plate && !params.vin) {
      return Result.fail('Debe especificar al menos la placa o el VIN');
    }

    const cleanPlate = params.plate ? params.plate.trim().toUpperCase() : null;
    const cleanVin = params.vin ? params.vin.trim().toUpperCase() : null;

    const data = await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      // 1. Vehículo
      const [vehicle] = await tx<
        {
          id: string;
          vin: string | null;
          current_plate: string | null;
          make: string;
          model: string;
          model_year: number | null;
          color: string | null;
          vehicle_type: string;
          current_mileage: number | null;
          current_operating_hours: number | null;
          warranty_end_date: Date | null;
          rtm_due_date: Date | null;
        }[]
      >`
        SELECT id, vin, current_plate, make, model, model_year, color,
               vehicle_type, current_mileage, current_operating_hours,
               warranty_end_date, rtm_due_date
        FROM vehicles
        WHERE (${cleanPlate}::text IS NOT NULL AND current_plate = ${cleanPlate})
           OR (${cleanVin}::text IS NOT NULL AND vin = ${cleanVin})
        LIMIT 1
      `;

      if (!vehicle) return null;

      // 2. Propietario primario
      const [owner] = await tx<
        {
          party_id: string;
          name: string;
          doc_num: string | null;
          phone: string | null;
          email: string | null;
        }[]
      >`
        SELECT vr.party_id,
               COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), c.legal_name, 'Propietario') as name,
               pi.id_number as doc_num,
               cp_phone.value as phone,
               cp_email.value as email
        FROM vehicle_relationships vr
        LEFT JOIN persons p ON vr.party_id = p.party_id
        LEFT JOIN companies c ON vr.party_id = c.party_id
        LEFT JOIN party_identifiers pi ON pi.party_id = vr.party_id
        LEFT JOIN party_contact_points cp_phone ON cp_phone.party_id = vr.party_id AND cp_phone.channel = 'phone' AND cp_phone.is_primary = true
        LEFT JOIN party_contact_points cp_email ON cp_email.party_id = vr.party_id AND cp_email.channel = 'email' AND cp_email.is_primary = true
        WHERE vr.vehicle_id = ${vehicle.id}::uuid
          AND vr.role = 'owner'
          AND vr.is_primary = true
          AND vr.valid_to IS NULL
        LIMIT 1
      `;

      // 3. Proyección de mantenimiento
      const [projection] = await tx<
        {
          projected_date: Date;
          projected_mileage: number | null;
          projection_method: string;
          confidence_level: string;
        }[]
      >`
        SELECT projected_date, projected_mileage, projection_method, confidence_level
        FROM next_visit_projections
        WHERE vehicle_id = ${vehicle.id}::uuid
        ORDER BY projected_date ASC
        LIMIT 1
      `;

      // 4. Oportunidades activas
      const opportunities = await tx<
        {
          id: string;
          rule_id: string;
          title: string;
          score: number;
          status: string;
        }[]
      >`
        SELECT id, rule_id, rule_id as title, score, status
        FROM opportunities
        WHERE vehicle_id = ${vehicle.id}::uuid
          AND status IN ('detected', 'in_progress', 'appointment_requested')
        ORDER BY score DESC
      `;

      return {
        vehicle,
        primaryOwner: owner || null,
        maintenanceProjection: projection || null,
        activeOpportunities: opportunities,
      };
    });

    if (!data) {
      return Result.fail(`No se encontró ningún vehículo con placa '${cleanPlate || cleanVin}'`);
    }

    return Result.ok(data);
  }
}

export class GetMaintenanceStatusTool implements IAiTool {
  readonly name = 'get_maintenance_status';
  readonly description =
    'Consulta el estado de mantenimiento preventivo proyectado para un vehículo (Decisión D-35: propio, cohorte o plan).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'plate',
      type: 'string',
      description: 'Placa del vehículo en Colombia',
      required: true,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(ctx: ToolExecutionContext, params: { plate: string }): Promise<Result<any, any>> {
    if (!params.plate) {
      return Result.fail('La placa es obligatoria');
    }

    const cleanPlate = params.plate.trim().toUpperCase();

    const data = await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      const rows = await tx<
        {
          plate: string;
          make: string;
          model: string;
          current_mileage: number | null;
          projected_date: Date | null;
          projected_mileage: number | null;
          projection_method: string | null;
          confidence_level: string | null;
        }[]
      >`
        SELECT v.current_plate as plate, v.make, v.model, v.current_mileage,
               p.projected_date, p.projected_mileage, p.projection_method, p.confidence_level
        FROM vehicles v
        LEFT JOIN next_visit_projections p ON v.id = p.vehicle_id
        WHERE v.current_plate = ${cleanPlate}
        LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!data) {
      return Result.fail(`Vehículo con placa '${cleanPlate}' no encontrado`);
    }

    const now = new Date();
    const daysRemaining = data.projected_date
      ? Math.round(
          (new Date(data.projected_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    return Result.ok({
      ...data,
      daysRemaining,
      isOverdue: daysRemaining !== null && daysRemaining < 0,
      confidenceText:
        data.confidence_level === 'high'
          ? 'Alta (historial propio)'
          : data.confidence_level === 'medium'
            ? 'Media (cohorte)'
            : 'Básica (plan de modelo)',
    });
  }
}
