import { Result, DomainError } from '@mia-crm/kernel';
import { Vehicle } from '../domain/vehicle';
import { Plate, Vin, Mileage, OperatingHours, SharePercentage } from '../domain/value-objects';
import type { VehicleRepository } from '../domain/vehicle-repository';

export interface UpsertVehicleFromErpDto {
  tenantId: string;
  externalCode: string;
  vin: string | null;
  plate: string | null;
  make: string;
  model: string;
  modelYear: number | null;
  color: string | null;
  engineNumber: string | null;
  mileage: number | null;
  operatingHours: number | null;
  warrantyEndDate: string | null;
  rtmDueDate: string | null;
  ownerPartyId: string | null;
}

export class UpsertVehicleFromErpUseCase {
  constructor(private readonly vehicleRepo: VehicleRepository) {}

  async execute(
    dto: UpsertVehicleFromErpDto,
  ): Promise<Result<{ vehicleId: string; isNew: boolean }, DomainError>> {
    // 1. Validar identificadores
    const vinVo = dto.vin ? Vin.create(dto.vin) : null;
    const plateVo = dto.plate ? Plate.create(dto.plate) : null;
    const mileageVo = dto.mileage !== null ? Mileage.create(dto.mileage) : null;
    const opHoursVo =
      dto.operatingHours !== null ? OperatingHours.create(dto.operatingHours) : null;

    // 2. Jerarquía de deduplicación (D-07): VIN > externalCode > Placa
    let vehicle: Vehicle | null = null;
    if (vinVo && vinVo.ok) {
      vehicle = await this.vehicleRepo.findByVin(vinVo.value.value);
    }
    if (!vehicle && dto.externalCode) {
      vehicle = await this.vehicleRepo.findByExternalCode(dto.externalCode.trim());
    }
    if (!vehicle && plateVo && plateVo.ok) {
      vehicle = await this.vehicleRepo.findByPlate(plateVo.value.value);
    }

    const warrantyDate = dto.warrantyEndDate ? new Date(dto.warrantyEndDate) : undefined;
    const rtmDate = dto.rtmDueDate ? new Date(dto.rtmDueDate) : undefined;
    let isNew = false;

    if (vehicle) {
      // Vehículo existente: actualizar atributos
      vehicle.updateDetails({
        color: dto.color ?? undefined,
        engineNumber: dto.engineNumber ?? undefined,
        warrantyEndDate: warrantyDate,
        rtmDueDate: rtmDate,
      });

      // Si cambió la placa, registrar en historial
      if (plateVo && plateVo.ok) {
        vehicle.changePlate(plateVo.value);
      }

      // Registrar kilometraje si viene informado
      if (mileageVo && mileageVo.ok) {
        vehicle.recordUsage({
          mileage: mileageVo.value,
          operatingHours: opHoursVo && opHoursVo.ok ? opHoursVo.value : undefined,
          source: 'erp_referencias_imp',
        });
      }

      // Reconciliación de propietario si viene informado
      if (dto.ownerPartyId) {
        const shareResult = SharePercentage.create(100);
        if (shareResult.ok) {
          vehicle.assignOwner(dto.ownerPartyId, shareResult.value, true);
        }
      }
    } else {
      // Nuevo vehículo
      isNew = true;
      vehicle = Vehicle.create({
        tenantId: dto.tenantId,
        externalCode: dto.externalCode.trim(),
        vin: vinVo && vinVo.ok ? vinVo.value : undefined,
        plate: plateVo && plateVo.ok ? plateVo.value : undefined,
        make: dto.make || 'AUTODETECT',
        model: dto.model || 'UNKNOWN',
        modelYear: dto.modelYear ?? undefined,
        color: dto.color ?? undefined,
        engineNumber: dto.engineNumber ?? undefined,
        initialMileage: mileageVo && mileageVo.ok ? mileageVo.value : undefined,
        initialOperatingHours: opHoursVo && opHoursVo.ok ? opHoursVo.value : undefined,
        warrantyEndDate: warrantyDate,
        rtmDueDate: rtmDate,
      });

      if (dto.ownerPartyId) {
        const shareResult = SharePercentage.create(100);
        if (shareResult.ok) {
          vehicle.assignOwner(dto.ownerPartyId, shareResult.value, true);
        }
      }
    }

    await this.vehicleRepo.save(vehicle);

    return Result.ok({ vehicleId: vehicle.id, isNew });
  }
}
