import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class UpcomingMaintenanceRule implements OpportunityRule {
  readonly id = 'R-MNT-01';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.projection) return null;

    const daysThreshold = Number(params?.daysThreshold ?? 30);
    const kmThreshold = Number(params?.kmThreshold ?? 1000);

    const diffMs = ctx.projection.projectedDate.getTime() - ctx.now.getTime();
    const daysUntilProjected = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let kmUntilProjected: number | undefined;
    if (ctx.projection.projectedMileage !== undefined && ctx.vehicle.currentMileage !== undefined) {
      kmUntilProjected = ctx.projection.projectedMileage - ctx.vehicle.currentMileage;
    }

    const isDueByDate = daysUntilProjected >= 0 && daysUntilProjected <= daysThreshold;
    const isDueByKm =
      kmUntilProjected !== undefined && kmUntilProjected >= 0 && kmUntilProjected <= kmThreshold;

    if (!isDueByDate && !isDueByKm) {
      return null;
    }

    // Calcular score (mayor cercanía = mayor score)
    const dateFactor = isDueByDate ? Math.max(0, 1 - daysUntilProjected / daysThreshold) : 0.5;
    const rawScore = 60 + dateFactor * 35;
    const scoreRes = Score.create(rawScore);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(80) as { ok: true; value: Score }).value;

    const expiresAt = new Date(ctx.projection.projectedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: 450000, // COP estimado mantenimiento preventivo promedio

      evidence: {
        projectedDate: ctx.projection.projectedDate.toISOString().split('T')[0],
        daysUntilProjected,
        projectedMileage: ctx.projection.projectedMileage,
        kmUntilProjected,
        projectionMethod: ctx.projection.projectionMethod,
        confidenceLevel: ctx.projection.confidenceLevel,
      },
      expiresAt,
    };
  }
}
