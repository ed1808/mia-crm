import { Result, DomainError } from '@mia-crm/kernel';

export type VehicleType =
  | 'passenger'
  | 'commercial_light'
  | 'commercial_heavy'
  | 'bus'
  | 'dump_truck';
export type RelationshipRole = 'owner' | 'driver' | 'fleet_operator' | 'lienholder' | 'contact';

export class Plate {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Plate, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return Result.fail(
        new DomainError('PLATE_REQUIRED', 'La placa del vehículo es obligatoria.'),
      );
    }

    const cleaned = raw
      .replace(/[\s\-]/g, '')
      .trim()
      .toUpperCase();
    if (cleaned.length < 5 || cleaned.length > 8) {
      return Result.fail(
        new DomainError('PLATE_INVALID_FORMAT', `Formato de placa inválido: ${raw}`),
      );
    }

    return Result.ok(new Plate(cleaned));
  }
}

export class Vin {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Vin, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return Result.fail(new DomainError('VIN_REQUIRED', 'El VIN/Chasis es obligatorio.'));
    }

    const cleaned = raw
      .replace(/[\s\-]/g, '')
      .trim()
      .toUpperCase();
    if (cleaned.length < 5 || cleaned.length > 25) {
      return Result.fail(
        new DomainError('VIN_INVALID_LENGTH', `Longitud de VIN/Chasis inválida: ${raw}`),
      );
    }

    return Result.ok(new Vin(cleaned));
  }
}

export class Mileage {
  private constructor(readonly value: number) {}

  static create(raw: number): Result<Mileage, DomainError> {
    if (raw === undefined || raw === null || isNaN(raw) || raw < 0) {
      return Result.fail(new DomainError('MILEAGE_INVALID', `Kilometraje inválido: ${raw}`));
    }

    return Result.ok(new Mileage(Math.round(raw)));
  }
}

export class OperatingHours {
  private constructor(readonly value: number) {}

  static create(raw: number): Result<OperatingHours, DomainError> {
    if (raw === undefined || raw === null || isNaN(raw) || raw < 0) {
      return Result.fail(
        new DomainError('OPERATING_HOURS_INVALID', `Horas de operación inválidas: ${raw}`),
      );
    }

    return Result.ok(new OperatingHours(Math.round(raw)));
  }
}

export class SharePercentage {
  private constructor(readonly value: number) {}

  static create(raw: number): Result<SharePercentage, DomainError> {
    if (raw === undefined || raw === null || isNaN(raw) || raw <= 0 || raw > 100) {
      return Result.fail(
        new DomainError(
          'SHARE_PERCENTAGE_INVALID',
          `Porcentaje de copropiedad debe estar entre 0.01 y 100: ${raw}`,
        ),
      );
    }

    return Result.ok(new SharePercentage(Number(raw.toFixed(2))));
  }
}
