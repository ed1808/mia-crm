import { NextVisitProjection } from '../next-visit-projection';
import type { ProjectionContext } from '../value-objects';
import type { ProjectionStrategy } from './projection-strategy';

export class CohortProjectionStrategy implements ProjectionStrategy {
  canProject(ctx: ProjectionContext): boolean {
    return (ctx.visits && ctx.visits.length === 1) || ctx.currentMileage !== undefined;
  }

  project(ctx: ProjectionContext): NextVisitProjection {
    const isHeavy =
      ctx.vehicleType === 'commercial_heavy' ||
      ctx.vehicleType === 'dump_truck' ||
      ctx.vehicleType === 'bus';

    // Parámetros típicos de cohorte
    const cohortDays = isHeavy ? 90 : 180;
    const cohortKmPerDay = isHeavy ? 150 : 35;

    const baseDate = ctx.lastVisitDate ?? ctx.referenceDate ?? new Date();
    const projectedDate = new Date(baseDate.getTime() + cohortDays * 24 * 60 * 60 * 1000);

    let projectedMileage: number | undefined;
    if (ctx.currentMileage !== undefined) {
      projectedMileage = ctx.currentMileage + cohortKmPerDay * cohortDays;
    }

    return NextVisitProjection.create({
      tenantId: ctx.tenantId,
      vehicleId: ctx.vehicleId,
      projectedDate,
      projectedMileage,
      projectionMethod: 'cohort',
      confidenceLevel: 'medium',
      calculationBasis: {
        method: 'cohort',
        isHeavyVehicle: isHeavy,
        cohortDaysInterval: cohortDays,
        cohortKmPerDay,
        baseDate: baseDate.toISOString(),
      },
      calculatedAt: ctx.referenceDate ?? new Date(),
    });
  }
}
