import type { RuleId } from './value-objects';

export interface RuleParamsRepository {
  getParams(ruleId: RuleId, version?: number): Promise<Record<string, unknown> | null>;
  saveParams(ruleId: RuleId, version: number, params: Record<string, unknown>): Promise<void>;
}
