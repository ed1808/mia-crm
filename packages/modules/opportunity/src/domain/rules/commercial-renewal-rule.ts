import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class CommercialRenewalRule implements OpportunityRule {
  readonly id = 'R-RET-01';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.vehicle.modelYear || !ctx.vehicle.currentMileage) return null;

    const currentYear = ctx.now.getFullYear();
    const ageYears = currentYear - ctx.vehicle.modelYear;
    const minAge = Number(params?.minAgeYears ?? 3);
    const maxAge = Number(params?.maxAgeYears ?? 5);
    const minMileage = Number(params?.minMileage ?? 60000);

    if (ageYears < minAge || ageYears > maxAge || ctx.vehicle.currentMileage < minMileage) {
      return null;
    }

    const scoreRes = Score.create(78);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(75) as { ok: true; value: Score }).value;
    const expiresAt = new Date(ctx.now.getTime() + 60 * 24 * 60 * 60 * 1000);

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 3500000, // Margen comercial retoma/renovación
      evidence: {
        modelYear: ctx.vehicle.modelYear,
        ageYears,
        currentMileage: ctx.vehicle.currentMileage,
        opportunityType: 'trade_in_or_new_sale',
      },
      expiresAt,
    };
  }
}
