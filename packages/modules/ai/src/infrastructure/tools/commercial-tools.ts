// packages/modules/ai/src/infrastructure/tools/commercial-tools.ts
import type { SQL } from 'bun';
import { Result } from '@mia-crm/kernel';
import { withTenant } from '@mia-crm/db';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';

export class ListMyLeadsTool implements IAiTool {
  readonly name = 'list_my_leads';
  readonly description =
    'Lista los leads comerciales asignados o activos, calculando el SLA restante en minutos (prioridad para leads con < 15 min).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'status',
      type: 'string',
      description: 'Filtrar por estado del lead: new, contacted, qualified, converted, lost',
      required: false,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(ctx: ToolExecutionContext, params: { status?: string }): Promise<Result<any, any>> {
    const leads = await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      const rows = await tx<
        {
          id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          source: string;
          status: string;
          sla_due_at: Date | null;
          first_contacted_at: Date | null;
          interested_vehicle_model: string | null;
          created_at: Date;
        }[]
      >`
        SELECT id, first_name, last_name, phone, email, source, status,
               sla_due_at, first_contacted_at, interested_vehicle_model, created_at
        FROM leads
        WHERE (${params.status ?? null}::text IS NULL OR status = ${params.status ?? null})
        ORDER BY
          CASE WHEN status = 'new' THEN 0 ELSE 1 END,
          sla_due_at ASC NULLS LAST
        LIMIT 20
      `;

      const now = new Date();
      return rows.map((r) => {
        const slaDue = r.sla_due_at ? new Date(r.sla_due_at) : null;
        const minutesRemaining = slaDue
          ? Math.round((slaDue.getTime() - now.getTime()) / 60000)
          : null;
        return {
          id: r.id,
          fullName: `${r.first_name} ${r.last_name || ''}`.trim(),
          phone: r.phone,
          email: r.email,
          channel: r.source,
          status: r.status,
          minutesRemainingSla: minutesRemaining,
          slaBreached: minutesRemaining !== null && minutesRemaining < 0 && !r.first_contacted_at,
          slaCritical:
            minutesRemaining !== null &&
            minutesRemaining >= 0 &&
            minutesRemaining <= 15 &&
            !r.first_contacted_at,
          interestedVehicleModel: r.interested_vehicle_model,
        };
      });
    });

    return Result.ok(leads);
  }
}

export class ListMyOpportunitiesTool implements IAiTool {
  readonly name = 'list_my_opportunities';
  readonly description =
    'Lista las oportunidades activas de posventa y comercial generadas por el motor predictivo de MIA CRM.';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'limit',
      type: 'number',
      description: 'Número máximo de oportunidades a retornar (por defecto 15)',
      required: false,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(ctx: ToolExecutionContext, params: { limit?: number }): Promise<Result<any, any>> {
    const lim = params.limit || 15;
    const opps = await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      const rows = await tx<
        {
          id: string;
          rule_code: string;
          title: string;
          score: number;
          status: string;
          experimental_group: string;
          plate: string | null;
          make: string | null;
          model: string | null;
          customer_name: string | null;
          phone: string | null;
        }[]
      >`
        SELECT o.id, o.rule_id as rule_code, o.rule_id as title, o.score, o.status,
               CASE WHEN o.is_control_group THEN 'control' ELSE 'intervened' END as experimental_group,
               v.current_plate as plate, v.make, v.model,
               COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), c.legal_name, 'Cliente') as customer_name,
               cp_phone.value as phone
        FROM opportunities o
        LEFT JOIN vehicles v ON o.vehicle_id = v.id
        LEFT JOIN parties party ON o.party_id = party.id
        LEFT JOIN persons p ON party.id = p.party_id
        LEFT JOIN companies c ON party.id = c.party_id
        LEFT JOIN party_contact_points cp_phone ON cp_phone.party_id = party.id AND cp_phone.channel = 'phone' AND cp_phone.is_primary = true
        WHERE o.status IN ('detected', 'in_progress', 'appointment_requested')
        ORDER BY o.score DESC
        LIMIT ${lim}
      `;
      return rows;
    });

    return Result.ok(opps);
  }
}

export class GetCustomer360Tool implements IAiTool {
  readonly name = 'get_customer_360';
  readonly description =
    'Obtiene la ficha Customer 360 de un cliente (Persona o Empresa) por documento o ID: datos de contacto, vehículos y consentimientos Ley 1581.';
  readonly autonomyLevel = AutonomyLevel.LEVEL_0_READ_ONLY;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'documentNumber',
      type: 'string',
      description: 'Cédula de Ciudadanía o NIT del cliente en Colombia',
      required: false,
    },
    {
      name: 'partyId',
      type: 'string',
      description: 'Identificador único UUID del Party',
      required: false,
    },
  ];

  constructor(private readonly sql: SQL) {}

  async execute(
    ctx: ToolExecutionContext,
    params: { documentNumber?: string; partyId?: string },
  ): Promise<Result<any, any>> {
    if (!params.documentNumber && !params.partyId) {
      return Result.fail('Debe suministrar documentNumber o partyId');
    }

    const doc = params.documentNumber ? params.documentNumber.trim() : null;
    const pid = params.partyId ?? null;

    const res = await withTenant(this.sql, { tenantId: ctx.tenantId }, async (tx) => {
      // 1. Party
      const [party] = await tx<
        {
          id: string;
          party_type: string;
          name: string;
          doc_num: string;
          phone: string | null;
          email: string | null;
          city: string | null;
        }[]
      >`
        SELECT party.id, party.party_type,
               COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), c.legal_name) as name,
               pi.id_number as doc_num,
               cp_phone.value as phone,
               cp_email.value as email,
               NULL as city
        FROM parties party
        LEFT JOIN persons p ON party.id = p.party_id
        LEFT JOIN companies c ON party.id = c.party_id
        LEFT JOIN party_identifiers pi ON pi.party_id = party.id
        LEFT JOIN party_contact_points cp_phone ON cp_phone.party_id = party.id AND cp_phone.channel = 'phone' AND cp_phone.is_primary = true
        LEFT JOIN party_contact_points cp_email ON cp_email.party_id = party.id AND cp_email.channel = 'email' AND cp_email.is_primary = true
        WHERE (${pid}::uuid IS NOT NULL AND party.id = ${pid}::uuid)
           OR (${doc}::text IS NOT NULL AND pi.id_number = ${doc})
        LIMIT 1
      `;

      if (!party) return null;

      // 2. Vehículos vinculados
      const vehicles = await tx<
        {
          id: string;
          plate: string | null;
          make: string;
          model: string;
          model_year: number | null;
          role: string;
          is_primary: boolean;
        }[]
      >`
        SELECT v.id, v.current_plate as plate, v.make, v.model, v.model_year,
               vr.role, vr.is_primary
        FROM vehicle_relationships vr
        JOIN vehicles v ON vr.vehicle_id = v.id
        WHERE vr.party_id = ${party.id}::uuid
          AND vr.valid_to IS NULL
      `;

      // 3. Consentimientos Ley 1581
      const consents = await tx<
        {
          purpose: string;
          channel: string;
          status: string;
        }[]
      >`
        SELECT purpose, channel, status
        FROM party_consents
        WHERE party_id = ${party.id}::uuid
      `;

      return {
        customer: party,
        vehicles,
        consents,
      };
    });

    if (!res) {
      return Result.fail(`No se encontró ningún cliente con documento '${doc || pid}'`);
    }

    return Result.ok(res);
  }
}
