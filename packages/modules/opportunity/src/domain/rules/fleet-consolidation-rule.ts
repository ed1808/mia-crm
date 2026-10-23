import { Score } from '../value-objects';
import type {
  OpportunityRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './opportunity-rule';

export class FleetConsolidationRule implements OpportunityRule {
  readonly id = 'R-FLT-01';
  readonly version = 1;

  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null {
    if (!ctx.vehicle.isCompanyOwner) return null;

    const minUnits = Number(params?.minFleetUnits ?? 3);
    const unitCount = ctx.fleetUnitCount ?? 1;

    if (unitCount < minUnits) {
      return null;
    }

    const scoreRes = Score.create(85);
    const scoreVal = scoreRes.ok
      ? scoreRes.value
      : (Score.create(80) as { ok: true; value: Score }).value;
    const expiresAt = new Date(ctx.now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      score: scoreVal,
      valueEstimate: unitCount * 450000, // Servicio agrupado de flota
      evidence: {
        isCompanyOwner: true,
        fleetUnitCount: unitCount,
        actionRecommended: 'consolidated_fleet_service_offer',
      },
      expiresAt,
    };
  }
}
