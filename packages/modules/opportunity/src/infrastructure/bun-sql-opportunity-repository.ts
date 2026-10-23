import type { SQL } from 'bun';
import { Opportunity } from '../domain/opportunity';
import type { OpportunityFilter, OpportunityRepository } from '../domain/opportunity-repository';
import { type OpportunityStatus, type RuleId, Score } from '../domain/value-objects';

interface OpportunityRow {
  id: string;
  tenant_id: string;
  rule_id: string;
  rule_version: number;
  vehicle_id: string;
  party_id: string;
  status: string;
  score: string | number;
  value_estimate: string | number | null;
  evidence: Record<string, unknown> | string;
  is_control_group: boolean;
  expires_at: Date | string | null;
  converted_at: Date | string | null;
  rejection_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class BunSqlOpportunityRepository implements OpportunityRepository {
  constructor(private readonly sql: SQL) {}

  private mapRowToEntity(row: OpportunityRow): Opportunity {
    const rawEvidence = row.evidence;
    const evidence = typeof rawEvidence === 'string' ? JSON.parse(rawEvidence) : rawEvidence;

    const rawScore = Number(row.score);
    const scoreRes = Score.create(rawScore);
    const score = scoreRes.ok
      ? scoreRes.value
      : (Score.create(0) as { ok: true; value: Score }).value;

    return Opportunity.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      ruleId: row.rule_id as RuleId,
      ruleVersion: row.rule_version,
      vehicleId: row.vehicle_id,
      partyId: row.party_id,
      status: row.status as OpportunityStatus,
      score,
      valueEstimate: row.value_estimate !== null ? Number(row.value_estimate) : undefined,
      evidence,
      isControlGroup: row.is_control_group,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      convertedAt: row.converted_at ? new Date(row.converted_at) : undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findById(id: string): Promise<Opportunity | null> {
    const rows = await this.sql<OpportunityRow[]>`
      SELECT
        id, tenant_id, rule_id, rule_version, vehicle_id, party_id,
        status, score, value_estimate, evidence, is_control_group,
        expires_at, converted_at, rejection_reason, created_at, updated_at
      FROM opportunities
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async findActiveByVehicleAndRule(vehicleId: string, ruleId: RuleId): Promise<Opportunity | null> {
    const rows = await this.sql<OpportunityRow[]>`
      SELECT
        id, tenant_id, rule_id, rule_version, vehicle_id, party_id,
        status, score, value_estimate, evidence, is_control_group,
        expires_at, converted_at, rejection_reason, created_at, updated_at
      FROM opportunities
      WHERE vehicle_id = ${vehicleId}::uuid
        AND rule_id = ${ruleId}
        AND status IN ('detected', 'in_progress', 'appointment_requested')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async findByVehicleId(vehicleId: string): Promise<Opportunity[]> {
    const rows = await this.sql<OpportunityRow[]>`
      SELECT
        id, tenant_id, rule_id, rule_version, vehicle_id, party_id,
        status, score, value_estimate, evidence, is_control_group,
        expires_at, converted_at, rejection_reason, created_at, updated_at
      FROM opportunities
      WHERE vehicle_id = ${vehicleId}::uuid
      ORDER BY created_at DESC
    `;

    return rows.map((r) => this.mapRowToEntity(r));
  }

  async find(filter?: OpportunityFilter): Promise<Opportunity[]> {
    const statusArray = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;

    const limit = filter?.limit ?? 100;
    const offset = filter?.offset ?? 0;

    const rows = await this.sql<OpportunityRow[]>`
      SELECT
        id, tenant_id, rule_id, rule_version, vehicle_id, party_id,
        status, score, value_estimate, evidence, is_control_group,
        expires_at, converted_at, rejection_reason, created_at, updated_at
      FROM opportunities
      WHERE (${filter?.vehicleId ?? null}::uuid IS NULL OR vehicle_id = ${filter?.vehicleId}::uuid)
        AND (${filter?.partyId ?? null}::uuid IS NULL OR party_id = ${filter?.partyId}::uuid)
        AND (${filter?.ruleId ?? null}::varchar IS NULL OR rule_id = ${filter?.ruleId})
        AND (${filter?.isControlGroup ?? null}::boolean IS NULL OR is_control_group = ${filter?.isControlGroup})
        AND (${statusArray}::varchar[] IS NULL OR status = ANY(${statusArray}))
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return rows.map((r) => this.mapRowToEntity(r));
  }

  async save(opportunity: Opportunity): Promise<void> {
    const evidenceJson = JSON.stringify(opportunity.evidence);
    const expiresAtStr = opportunity.expiresAt ? opportunity.expiresAt.toISOString() : null;
    const convertedAtStr = opportunity.convertedAt ? opportunity.convertedAt.toISOString() : null;

    await this.sql`
      INSERT INTO opportunities (
        id, tenant_id, rule_id, rule_version, vehicle_id, party_id,
        status, score, value_estimate, evidence, is_control_group,
        expires_at, converted_at, rejection_reason, created_at, updated_at
      ) VALUES (
        ${opportunity.id}::uuid,
        ${opportunity.tenantId}::uuid,
        ${opportunity.ruleId},
        ${opportunity.ruleVersion},
        ${opportunity.vehicleId}::uuid,
        ${opportunity.partyId}::uuid,
        ${opportunity.status},
        ${opportunity.score.value},
        ${opportunity.valueEstimate ?? null},
        ${evidenceJson}::jsonb,
        ${opportunity.isControlGroup},
        ${expiresAtStr}::timestamptz,
        ${convertedAtStr}::timestamptz,
        ${opportunity.rejectionReason ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        score = EXCLUDED.score,
        value_estimate = EXCLUDED.value_estimate,
        evidence = EXCLUDED.evidence,
        expires_at = EXCLUDED.expires_at,
        converted_at = EXCLUDED.converted_at,
        rejection_reason = EXCLUDED.rejection_reason,
        updated_at = NOW()
    `;

    for (const event of opportunity.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload
        ) VALUES (
          ${opportunity.tenantId}::uuid,
          ${event.eventType},
          'Opportunity',
          ${opportunity.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }

    opportunity.clearDomainEvents();
  }
}
