import { NextVisitProjection } from '../next-visit-projection';
import type { ProjectionContext } from '../value-objects';
import type { ProjectionStrategy } from './projection-strategy';

export class OwnHistoryProjectionStrategy implements ProjectionStrategy {
  canProject(ctx: ProjectionContext): boolean {
    return ctx.visits && ctx.visits.length >= 2;
  }

  project(ctx: ProjectionContext): NextVisitProjection {
    const visits = [...ctx.visits].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
    const isHeavy =
      ctx.vehicleType === 'commercial_heavy' ||
      ctx.vehicleType === 'dump_truck' ||
      ctx.vehicleType === 'bus';

    // 1. Calcular promedio de días entre visitas consecutivas
    let totalDays = 0;
    for (let i = 1; i < visits.length; i++) {
      const prev = visits[i - 1]!;
      const curr = visits[i]!;
      const diffMs = curr.enteredAt.getTime() - prev.enteredAt.getTime();
      const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      totalDays += days;
    }
    const avgDays = Math.max(15, Math.round(totalDays / (visits.length - 1)));

    // 2. Calcular km/día promedio si hay kilometrajes informados
    const firstVisit = visits[0]!;
    const lastVisit = visits[visits.length - 1]!;
    let kmPerDay = 0;
    if (
      firstVisit.mileage !== undefined &&
      lastVisit.mileage !== undefined &&
      lastVisit.mileage > firstVisit.mileage
    ) {
      const daysSpan = Math.max(
        1,
        Math.round(
          (lastVisit.enteredAt.getTime() - firstVisit.enteredAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      kmPerDay = Math.round((lastVisit.mileage - firstVisit.mileage) / daysSpan);
    }

    // 3. Proyección de fecha y kilometraje
    // Para pesados: mayor peso a la diferencia en días entre entradas
    const baseDate = lastVisit.enteredAt;
    const projectedDate = new Date(baseDate.getTime() + avgDays * 24 * 60 * 60 * 1000);

    let projectedMileage: number | undefined;
    if (ctx.currentMileage !== undefined && kmPerDay > 0) {
      projectedMileage = ctx.currentMileage + kmPerDay * avgDays;
    }

    return NextVisitProjection.create({
      tenantId: ctx.tenantId,
      vehicleId: ctx.vehicleId,
      projectedDate,
      projectedMileage,
      projectionMethod: 'own_history',
      confidenceLevel: 'high',
      calculationBasis: {
        method: 'own_history',
        isHeavyVehicle: isHeavy,
        visitCount: visits.length,
        avgDaysBetweenVisits: avgDays,
        estimatedKmPerDay: kmPerDay,
        lastVisitDate: lastVisit.enteredAt.toISOString(),
      },
      calculatedAt: ctx.referenceDate ?? new Date(),
    });
  }
}
