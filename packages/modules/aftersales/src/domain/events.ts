import type { DomainEvent } from '@mia-crm/kernel';

export interface WorkOrderOpenedPayload {
  workOrderId: string;
  tenantId: string;
  vehicleId: string;
  partyId: string;
  orderNumber: number;
  branchCode: number;
  orderType: string;
  mileage: number | null;
  enteredAt: string;
}

export class WorkOrderOpenedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'WorkOrderOpened';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: WorkOrderOpenedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface WorkOrderCompletedPayload {
  workOrderId: string;
  tenantId: string;
  vehicleId: string;
  partyId: string;
  orderNumber: number;
  orderType: string;
  mileage: number | null;
  closedAt: string;
}

export class WorkOrderCompletedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'WorkOrderCompleted';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: WorkOrderCompletedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}
