import type { DomainEvent } from '@mia-crm/kernel';

export interface NextVisitProjectedPayload {
  vehicleId: string;
  tenantId: string;
  projectedDate: string;
  projectedMileage: number | null;
  projectionMethod: string;
  confidenceLevel: string;
  calculationBasis: Record<string, unknown>;
  calculatedAt: string;
}

export class NextVisitProjectedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'NextVisitProjected';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: NextVisitProjectedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}
