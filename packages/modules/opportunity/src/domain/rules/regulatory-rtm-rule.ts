import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class RegulatoryRtmDueRule implements OpportunityRule {
  readonly id = 'R-RTM-01';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.vehicle.rtmDueDate) return null;

    const daysThreshold = Number(params?.rtmDaysThreshold ?? 30);
    const diffMs = ctx.vehicle.rtmDueDate.getTime() - ctx.now.getTime();
    const daysUntilRtm = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilRtm < 0 || daysUntilRtm > daysThreshold) {
      return null;
    }

    const rawScore = 85 + (1 - daysUntilRtm / daysThreshold) * 12;
    const scoreRes = Score.create(rawScore);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(90) as { ok: true; value: Score }).value;
    const expiresAt = ctx.vehicle.rtmDueDate;

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 320000,
      evidence: {
        rtmDueDate: ctx.vehicle.rtmDueDate.toISOString().split('T')[0],
        daysUntilRtm,
        regulatoryCompliance: 'mandatory_colombian_rtm',
      },
      expiresAt,
    };
  }
}
