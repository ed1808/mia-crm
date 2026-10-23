import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class UpcomingWarrantyExpirationRule implements OpportunityRule {
  readonly id = 'R-WAR-01';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.vehicle.warrantyEndDate) return null;

    const daysThreshold = Number(params?.warrantyDaysThreshold ?? 60);
    const diffMs = ctx.vehicle.warrantyEndDate.getTime() - ctx.now.getTime();
    const daysUntilWarrantyEnd = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilWarrantyEnd < 0 || daysUntilWarrantyEnd > daysThreshold) {
      return null;
    }

    const rawScore = 80 + (1 - daysUntilWarrantyEnd / daysThreshold) * 15;
    const scoreRes = Score.create(rawScore);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(85) as { ok: true; value: Score }).value;
    const expiresAt = ctx.vehicle.warrantyEndDate;

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 800000,
      evidence: {
        warrantyEndDate: ctx.vehicle.warrantyEndDate.toISOString().split('T')[0],
        daysUntilWarrantyEnd,
        urgency: 'critical_retention_window',
      },
      expiresAt,
    };
  }
}
