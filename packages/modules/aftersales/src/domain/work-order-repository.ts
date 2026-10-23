import type { WorkOrder } from './work-order';

export interface WorkOrderRepository {
  save(order: WorkOrder): Promise<void>;
  findById(id: string): Promise<WorkOrder | null>;
  findByExternalId(externalId: string): Promise<WorkOrder | null>;
  findByVehicleId(vehicleId: string): Promise<WorkOrder[]>;
}
