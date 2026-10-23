import type { Vehicle } from './vehicle';

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<void>;
  findById(id: string): Promise<Vehicle | null>;
  findByVin(vin: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByExternalCode(code: string): Promise<Vehicle | null>;
}
