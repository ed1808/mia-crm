import type { NextVisitProjection } from './next-visit-projection';

export interface MaintenanceProjectionRepository {
  save(projection: NextVisitProjection): Promise<void>;
  findByVehicleId(vehicleId: string): Promise<NextVisitProjection | null>;
}
