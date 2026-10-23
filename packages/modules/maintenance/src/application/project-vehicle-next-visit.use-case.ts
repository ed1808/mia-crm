import { Result, DomainError } from '@mia-crm/kernel';
import { NextVisitProjector } from '../domain/next-visit-projector';
import type { NextVisitProjection } from '../domain/next-visit-projection';
import type { MaintenanceProjectionRepository } from '../domain/maintenance-projection-repository';
import type { ProjectionContext } from '../domain/value-objects';

export class ProjectVehicleNextVisitUseCase {
  private readonly projector: NextVisitProjector;

  constructor(private readonly projectionRepo: MaintenanceProjectionRepository) {
    this.projector = new NextVisitProjector();
  }

  async execute(ctx: ProjectionContext): Promise<Result<NextVisitProjection, DomainError>> {
    const existing = await this.projectionRepo.findByVehicleId(ctx.vehicleId);

    const calculated = this.projector.calculate(ctx);

    if (existing) {
      existing.update({
        projectedDate: calculated.projectedDate,
        projectedMileage: calculated.projectedMileage,
        projectionMethod: calculated.projectionMethod,
        confidenceLevel: calculated.confidenceLevel,
        calculationBasis: calculated.calculationBasis,
        calculatedAt: calculated.calculatedAt,
      });
      await this.projectionRepo.save(existing);
      return Result.ok(existing);
    }

    await this.projectionRepo.save(calculated);
    return Result.ok(calculated);
  }
}
