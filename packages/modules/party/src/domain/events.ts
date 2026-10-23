import type { DomainEvent } from '@mia-crm/kernel';

export interface PartyUpsertedPayload {
  partyId: string;
  tenantId: string;
  partyType: 'person' | 'company';
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}

export class PartyUpsertedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'PartyUpserted';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: PartyUpsertedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}

export interface PartySuppressedPayload {
  partyId: string;
  tenantId: string;
  documentHash: string;
  reason: string;
}

export class PartySuppressedDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType = 'PartySuppressed';
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    readonly aggregateId: string,
    payload: PartySuppressedPayload,
    occurredAt?: Date,
  ) {
    this.eventId = crypto.randomUUID();
    this.tenantId = payload.tenantId;
    this.occurredAt = (occurredAt ?? new Date()).toISOString();
    this.payload = payload as unknown as Record<string, unknown>;
  }
}
