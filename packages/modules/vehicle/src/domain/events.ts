import type { DomainEvent } from '@mia-crm/kernel';

export interface VehicleUpsertedPayload {
  vehicleId: string;
  tenantId: string;
  vin: string | null;
  plate: string | null;
  make: string;
  model: string;
  modelYear: number | null;
  color: string | null;
  currentMileage: number | null;
  currentOperatingHours: number | null;
  warrantyEndDate: string | null;
  rtmDueDate: string | null;
}

export class VehicleUpsertedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'VehicleUpserted';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: VehicleUpsertedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface PlateChangedPayload {
  vehicleId: string;
  tenantId: string;
  oldPlate: string | null;
  newPlate: string;
  changedAt: string;
}

export class PlateChangedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'PlateChanged';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: PlateChangedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface UsageRecordedPayload {
  vehicleId: string;
  tenantId: string;
  mileage: number | null;
  operatingHours: number | null;
  source: string;
  isAnomaly: boolean;
  recordedAt: string;
}

export class UsageRecordedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'UsageRecorded';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: UsageRecordedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface VehicleOwnershipChangedPayload {
  vehicleId: string;
  tenantId: string;
  previousPrimaryOwnerPartyId: string | null;
  newPrimaryOwnerPartyId: string;
  sharePercentage: number;
  changedAt: string;
}

export class VehicleOwnershipChangedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'VehicleOwnershipChanged';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: VehicleOwnershipChangedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}
