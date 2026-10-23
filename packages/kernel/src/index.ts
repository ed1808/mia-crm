export class DomainError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },
  fail<E>(error: E): Result<never, E> {
    return { ok: false, error };
  },
};

export interface Clock {
  now(): Date;
  isoNow(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  isoNow(): string {
    return new Date().toISOString();
  }
}

export class FrozenClock implements Clock {
  private currentDate: Date;

  constructor(dateOrIso: Date | string) {
    this.currentDate = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  }

  now(): Date {
    return new Date(this.currentDate.getTime());
  }

  isoNow(): string {
    return this.currentDate.toISOString();
  }

  advanceMs(ms: number): void {
    this.currentDate = new Date(this.currentDate.getTime() + ms);
  }
}

export interface ValueObject<T> {
  equals(other: ValueObject<T>): boolean;
}

export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other?: Entity<TId>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.id === other.id;
  }
}

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;
}

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
