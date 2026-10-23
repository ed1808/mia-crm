import { AggregateRoot } from '@mia-crm/kernel';
import type {
  Plate,
  Vin,
  Mileage,
  OperatingHours,
  SharePercentage,
  VehicleType,
  RelationshipRole,
} from './value-objects';
import {
  VehicleUpsertedDomainEvent,
  PlateChangedDomainEvent,
  UsageRecordedDomainEvent,
  VehicleOwnershipChangedDomainEvent,
} from './events';

export interface PlateHistoryEntry {
  id: string;
  plate: Plate;
  validFrom: Date;
  validTo?: Date;
}

export interface VehicleRelationshipEntry {
  id: string;
  partyId: string;
  role: RelationshipRole;
  sharePercentage: SharePercentage;
  isPrimary: boolean;
  validFrom: Date;
  validTo?: Date;
}

export interface UsageReadingEntry {
  source: string;
  mileage?: Mileage;
  operatingHours?: OperatingHours;
  readingDate: Date;
  isAnomaly: boolean;
}

export interface VehicleProps {
  id: string;
  tenantId: string;
  externalCode?: string;
  vin?: Vin;
  currentPlate?: Plate;
  make: string;
  model: string;
  modelYear?: number;
  color?: string;
  engineNumber?: string;
  vehicleType: VehicleType;
  currentMileage?: Mileage;
  currentOperatingHours?: OperatingHours;
  warrantyEndDate?: Date;
  rtmDueDate?: Date;
  plateHistory: PlateHistoryEntry[];
  relationships: VehicleRelationshipEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class Vehicle extends AggregateRoot<string> {
  private _externalCode?: string;
  private _vin?: Vin;
  private _currentPlate?: Plate;
  private _make: string;
  private _model: string;
  private _modelYear?: number;
  private _color?: string;
  private _engineNumber?: string;
  private _vehicleType: VehicleType;
  private _currentMileage?: Mileage;
  private _currentOperatingHours?: OperatingHours;
  private _warrantyEndDate?: Date;
  private _rtmDueDate?: Date;
  private _plateHistory: PlateHistoryEntry[];
  private _relationships: VehicleRelationshipEntry[];
  private _updatedAt: Date;

  private constructor(
    id: string,
    readonly tenantId: string,
    props: Omit<VehicleProps, 'id' | 'tenantId'>,
  ) {
    super(id);
    this._externalCode = props.externalCode;
    this._vin = props.vin;
    this._currentPlate = props.currentPlate;
    this._make = props.make;
    this._model = props.model;
    this._modelYear = props.modelYear;
    this._color = props.color;
    this._engineNumber = props.engineNumber;
    this._vehicleType = props.vehicleType;
    this._currentMileage = props.currentMileage;
    this._currentOperatingHours = props.currentOperatingHours;
    this._warrantyEndDate = props.warrantyEndDate;
    this._rtmDueDate = props.rtmDueDate;
    this._plateHistory = [...props.plateHistory];
    this._relationships = [...props.relationships];
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    tenantId: string;
    externalCode?: string;
    vin?: Vin;
    plate?: Plate;
    make: string;
    model: string;
    modelYear?: number;
    color?: string;
    engineNumber?: string;
    vehicleType?: VehicleType;
    initialMileage?: Mileage;
    initialOperatingHours?: OperatingHours;
    warrantyEndDate?: Date;
    rtmDueDate?: Date;
  }): Vehicle {
    const id = props.id ?? crypto.randomUUID();
    const now = new Date();

    const plateHistory: PlateHistoryEntry[] = [];
    if (props.plate) {
      plateHistory.push({
        id: crypto.randomUUID(),
        plate: props.plate,
        validFrom: now,
      });
    }

    const vehicle = new Vehicle(id, props.tenantId, {
      externalCode: props.externalCode,
      vin: props.vin,
      currentPlate: props.plate,
      make: props.make,
      model: props.model,
      modelYear: props.modelYear,
      color: props.color,
      engineNumber: props.engineNumber,
      vehicleType: props.vehicleType ?? 'passenger',
      currentMileage: props.initialMileage,
      currentOperatingHours: props.initialOperatingHours,
      warrantyEndDate: props.warrantyEndDate,
      rtmDueDate: props.rtmDueDate,
      plateHistory,
      relationships: [],
      createdAt: now,
      updatedAt: now,
    });

    vehicle.addDomainEvent(
      new VehicleUpsertedDomainEvent(
        id,
        {
          vehicleId: id,
          tenantId: props.tenantId,
          vin: props.vin ? props.vin.value : null,
          plate: props.plate ? props.plate.value : null,
          make: props.make,
          model: props.model,
          modelYear: props.modelYear ?? null,
          color: props.color ?? null,
          currentMileage: props.initialMileage ? props.initialMileage.value : null,
          currentOperatingHours: props.initialOperatingHours
            ? props.initialOperatingHours.value
            : null,
          warrantyEndDate: props.warrantyEndDate ? props.warrantyEndDate.toISOString() : null,
          rtmDueDate: props.rtmDueDate ? props.rtmDueDate.toISOString() : null,
        },
        now,
      ),
    );

    return vehicle;
  }

  static reconstitute(props: VehicleProps): Vehicle {
    return new Vehicle(props.id, props.tenantId, props);
  }

  get externalCode(): string | undefined {
    return this._externalCode;
  }

  get vin(): Vin | undefined {
    return this._vin;
  }

  get currentPlate(): Plate | undefined {
    return this._currentPlate;
  }

  get make(): string {
    return this._make;
  }

  get model(): string {
    return this._model;
  }

  get modelYear(): number | undefined {
    return this._modelYear;
  }

  get color(): string | undefined {
    return this._color;
  }

  get engineNumber(): string | undefined {
    return this._engineNumber;
  }

  get vehicleType(): VehicleType {
    return this._vehicleType;
  }

  get currentMileage(): Mileage | undefined {
    return this._currentMileage;
  }

  get currentOperatingHours(): OperatingHours | undefined {
    return this._currentOperatingHours;
  }

  get warrantyEndDate(): Date | undefined {
    return this._warrantyEndDate;
  }

  get rtmDueDate(): Date | undefined {
    return this._rtmDueDate;
  }

  get plateHistory(): readonly PlateHistoryEntry[] {
    return this._plateHistory;
  }

  get relationships(): readonly VehicleRelationshipEntry[] {
    return this._relationships;
  }

  get primaryOwner(): VehicleRelationshipEntry | undefined {
    return this._relationships.find((r) => r.role === 'owner' && r.isPrimary && !r.validTo);
  }

  get activeOwners(): readonly VehicleRelationshipEntry[] {
    return this._relationships.filter((r) => r.role === 'owner' && !r.validTo);
  }

  /**
   * Cambia la placa del vehículo preservando el historial temporal completo (D-07)
   */
  changePlate(newPlate: Plate, changedAt: Date = new Date()): void {
    const oldPlate = this._currentPlate ? this._currentPlate.value : null;
    if (oldPlate === newPlate.value) return;

    // Cerrar entrada anterior de placa
    for (const entry of this._plateHistory) {
      if (!entry.validTo) {
        entry.validTo = changedAt;
      }
    }

    // Agregar nueva placa al historial
    this._plateHistory.push({
      id: crypto.randomUUID(),
      plate: newPlate,
      validFrom: changedAt,
    });

    this._currentPlate = newPlate;
    this._updatedAt = changedAt;

    this.addDomainEvent(
      new PlateChangedDomainEvent(
        this.id,
        {
          vehicleId: this.id,
          tenantId: this.tenantId,
          oldPlate,
          newPlate: newPlate.value,
          changedAt: changedAt.toISOString(),
        },
        changedAt,
      ),
    );
  }

  /**
   * Asigna o transfiere propiedad con invariante de propietario principal único (D-43)
   */
  assignOwner(
    partyId: string,
    sharePercentage: SharePercentage,
    isPrimary: boolean,
    effectiveAt: Date = new Date(),
  ): void {
    let previousOwnerId: string | null = null;

    if (isPrimary) {
      // Cerrar propietario principal actual vigente
      for (const rel of this._relationships) {
        if (rel.role === 'owner' && rel.isPrimary && !rel.validTo) {
          if (rel.partyId === partyId) {
            // Ya es el propietario principal vigente
            return;
          }
          rel.validTo = effectiveAt;
          previousOwnerId = rel.partyId;
        }
      }
    }

    // Agregar nueva relación de propiedad
    this._relationships.push({
      id: crypto.randomUUID(),
      partyId,
      role: 'owner',
      sharePercentage,
      isPrimary,
      validFrom: effectiveAt,
    });

    this._updatedAt = effectiveAt;

    if (isPrimary) {
      this.addDomainEvent(
        new VehicleOwnershipChangedDomainEvent(
          this.id,
          {
            vehicleId: this.id,
            tenantId: this.tenantId,
            previousPrimaryOwnerPartyId: previousOwnerId,
            newPrimaryOwnerPartyId: partyId,
            sharePercentage: sharePercentage.value,
            changedAt: effectiveAt.toISOString(),
          },
          effectiveAt,
        ),
      );
    }
  }

  /**
   * Asocia otros roles temporales (conductor, operador de flota, acreedor prendario)
   */
  assignRelationship(
    partyId: string,
    role: RelationshipRole,
    isPrimary: boolean,
    effectiveAt: Date = new Date(),
  ): void {
    this._relationships.push({
      id: crypto.randomUUID(),
      partyId,
      role,
      sharePercentage: { value: 0 } as SharePercentage,
      isPrimary,
      validFrom: effectiveAt,
    });
    this._updatedAt = effectiveAt;
  }

  /**
   * Registra lectura de odómetro/horómetro con detección de anomalías regresivas
   */
  recordUsage(params: {
    mileage?: Mileage;
    operatingHours?: OperatingHours;
    source: string;
    readingDate?: Date;
  }): { isAnomaly: boolean } {
    const readingDate = params.readingDate ?? new Date();
    let isAnomaly = false;

    if (params.mileage) {
      if (this._currentMileage && params.mileage.value < this._currentMileage.value) {
        // Regresión de kilometraje: marcada como anomalía
        isAnomaly = true;
      } else {
        this._currentMileage = params.mileage;
      }
    }

    if (params.operatingHours) {
      if (
        this._currentOperatingHours &&
        params.operatingHours.value < this._currentOperatingHours.value
      ) {
        isAnomaly = true;
      } else {
        this._currentOperatingHours = params.operatingHours;
      }
    }

    this._updatedAt = readingDate;

    this.addDomainEvent(
      new UsageRecordedDomainEvent(
        this.id,
        {
          vehicleId: this.id,
          tenantId: this.tenantId,
          mileage: params.mileage ? params.mileage.value : null,
          operatingHours: params.operatingHours ? params.operatingHours.value : null,
          source: params.source,
          isAnomaly,
          recordedAt: readingDate.toISOString(),
        },
        readingDate,
      ),
    );

    return { isAnomaly };
  }

  updateDetails(props: {
    color?: string;
    engineNumber?: string;
    warrantyEndDate?: Date;
    rtmDueDate?: Date;
  }): void {
    if (props.color !== undefined) this._color = props.color;
    if (props.engineNumber !== undefined) this._engineNumber = props.engineNumber;
    if (props.warrantyEndDate !== undefined) this._warrantyEndDate = props.warrantyEndDate;
    if (props.rtmDueDate !== undefined) this._rtmDueDate = props.rtmDueDate;
    this._updatedAt = new Date();
  }
}
