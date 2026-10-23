import type { SQL } from 'bun';
import type { RuleParamsRepository } from '../domain/rule-params-repository';
import type { RuleId } from '../domain/value-objects';

export class BunSqlRuleParamsRepository implements RuleParamsRepository {
  constructor(private readonly sql: SQL) {}

  async getParams(ruleId: RuleId, version = 1): Promise<Record<string, unknown> | null> {
    const rows = await this.sql<{ params: Record<string, unknown> | string }[]>`
      SELECT params
      FROM rule_params
      WHERE rule_id = ${ruleId}
        AND version = ${version}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    const raw = row.params;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async saveParams(
    ruleId: RuleId,
    version: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    const paramsJson = JSON.stringify(params);

    await this.sql`
      INSERT INTO rule_params (
        tenant_id, rule_id, version, params, created_at
      ) VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::UUID,
        ${ruleId},
        ${version},
        ${paramsJson}::jsonb,
        NOW()
      )
      ON CONFLICT (tenant_id, rule_id, version) DO UPDATE SET
        params = EXCLUDED.params
    `;
  }
}
