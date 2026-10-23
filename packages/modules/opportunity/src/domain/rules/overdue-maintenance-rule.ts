import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class OverdueMaintenanceRule implements OpportunityRule {
  readonly id = 'R-MNT-02';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.projection) return null;

    const maxOverdueDays = Number(params?.maxOverdueDays ?? 90);

    const diffMs = ctx.projection.projectedDate.getTime() - ctx.now.getTime();
    const daysUntilProjected = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Vencido: días negativos
    if (daysUntilProjected >= 0 || Math.abs(daysUntilProjected) > maxOverdueDays) {
      return null;
    }

    const overdueDays = Math.abs(daysUntilProjected);
    // Score alto por urgencia de retención
    const rawScore = Math.min(95, 75 + (overdueDays / maxOverdueDays) * 20);
    const scoreRes = Score.create(rawScore);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(85) as { ok: true; value: Score }).value;

    const expiresAt = new Date(ctx.now.getTime() + 15 * 24 * 60 * 60 * 1000);

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 500000,
      evidence: {
        projectedDate: ctx.projection.projectedDate.toISOString().split('T')[0],
        overdueDays,
        lastVisitDate: ctx.lastVisitDate ? ctx.lastVisitDate.toISOString().split('T')[0] : null,
      },
      expiresAt,
    };
  }
}
