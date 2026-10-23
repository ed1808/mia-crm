import type { ProjectionContext } from './value-objects';
import type { NextVisitProjection } from './next-visit-projection';
import type { ProjectionStrategy } from './strategies/projection-strategy';
import { OwnHistoryProjectionStrategy } from './strategies/own-history-strategy';
import { CohortProjectionStrategy } from './strategies/cohort-strategy';
import { DefaultPlanProjectionStrategy } from './strategies/default-plan-strategy';

export class NextVisitProjector {
  private readonly strategies: ProjectionStrategy[];

  constructor(customStrategies?: ProjectionStrategy[]) {
    this.strategies = customStrategies ?? [
      new OwnHistoryProjectionStrategy(),
      new CohortProjectionStrategy(),
      new DefaultPlanProjectionStrategy(),
    ];
  }

  calculate(ctx: ProjectionContext): NextVisitProjection {
    for (const strategy of this.strategies) {
      if (strategy.canProject(ctx)) {
        return strategy.project(ctx);
      }
    }

    // Fallback asegurado
    return new DefaultPlanProjectionStrategy().project(ctx);
  }
}
