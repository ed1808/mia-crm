import type { DomainEvent } from '@mia-crm/kernel';

export interface OpportunityDetectedPayload {
  opportunityId: string;
  tenantId: string;
  ruleId: string;
  vehicleId: string;
  partyId: string;
  score: number;
  valueEstimate: number | null;
  isControlGroup: boolean;
  evidence: Record<string, unknown>;
}

export class OpportunityDetectedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'OpportunityDetected';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: OpportunityDetectedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface OpportunityStatusChangedPayload {
  opportunityId: string;
  tenantId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: string;
}

export class OpportunityStatusChangedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'OpportunityStatusChanged';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: OpportunityStatusChangedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface OpportunityConvertedPayload {
  opportunityId: string;
  tenantId: string;
  vehicleId: string;
  partyId: string;
  valueEstimate: number | null;
  convertedAt: string;
}

export class OpportunityConvertedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'OpportunityConverted';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: OpportunityConvertedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}
