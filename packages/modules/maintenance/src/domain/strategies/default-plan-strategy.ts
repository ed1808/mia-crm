import { NextVisitProjection } from '../next-visit-projection';
import type { ProjectionContext } from '../value-objects';
import type { ProjectionStrategy } from './projection-strategy';

export class DefaultPlanProjectionStrategy implements ProjectionStrategy {
  canProject(_ctx: ProjectionContext): boolean {
    return true; // Fallback universal
  }

  project(ctx: ProjectionContext): NextVisitProjection {
    const isHeavy =
      ctx.vehicleType === 'commercial_heavy' ||
      ctx.vehicleType === 'dump_truck' ||
      ctx.vehicleType === 'bus';

    const planDays = isHeavy ? 90 : 180;
    const baseDate = ctx.referenceDate ?? new Date();
    const projectedDate = new Date(baseDate.getTime() + planDays * 24 * 60 * 60 * 1000);

    return NextVisitProjection.create({
      tenantId: ctx.tenantId,
      vehicleId: ctx.vehicleId,
      projectedDate,
      projectedMileage: undefined,
      projectionMethod: 'plan',
      confidenceLevel: 'low',
      calculationBasis: {
        method: 'plan',
        isHeavyVehicle: isHeavy,
        planDaysInterval: planDays,
        baseDate: baseDate.toISOString(),
      },
      calculatedAt: ctx.referenceDate ?? new Date(),
    });
  }
}
