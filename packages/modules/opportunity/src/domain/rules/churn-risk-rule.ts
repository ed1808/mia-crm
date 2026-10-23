import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class ChurnRiskMaintenanceRule implements OpportunityRule {
  readonly id = 'R-MNT-03';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.lastVisitDate) return null;

    const thresholdDays = Number(params?.churnThresholdDays ?? 365); // 12 meses
    const diffMs = ctx.now.getTime() - ctx.lastVisitDate.getTime();
    const daysSinceLastVisit = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysSinceLastVisit <= thresholdDays) {
      return null;
    }

    const scoreRes = Score.create(72);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(70) as { ok: true; value: Score }).value;
    const expiresAt = new Date(ctx.now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 650000,
      evidence: {
        lastVisitDate: ctx.lastVisitDate.toISOString().split('T')[0],
        daysSinceLastVisit,
        monthsInactive: Number((daysSinceLastVisit / 30).toFixed(1)),
      },
      expiresAt,
    };
  }
}
