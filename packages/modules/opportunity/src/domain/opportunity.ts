import { AggregateRoot } from '@mia-crm/kernel';
import {
  OpportunityConvertedDomainEvent,
  OpportunityDetectedDomainEvent,
  OpportunityStatusChangedDomainEvent,
} from './events';
import type { OpportunityStatus, RuleId, Score } from './value-objects';

export interface OpportunityProps {
  id: string;
  tenantId: string;
  ruleId: RuleId;
  ruleVersion: number;
  vehicleId: string;
  partyId: string;
  status: OpportunityStatus;
  score: Score;
  valueEstimate?: number;
  evidence: Record<string, unknown>;
  isControlGroup: boolean;
  expiresAt?: Date;
  convertedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Opportunity extends AggregateRoot<string> {
  private _status: OpportunityStatus;
  private _score: Score;
  private _valueEstimate?: number;
  private _evidence: Record<string, unknown>;
  private _expiresAt?: Date;
  private _convertedAt?: Date;
  private _rejectionReason?: string;
  private _updatedAt: Date;

  private constructor(
    id: string,
    readonly tenantId: string,
    readonly ruleId: RuleId,
    readonly ruleVersion: number,
    readonly vehicleId: string,
    readonly partyId: string,
    readonly isControlGroup: boolean,
    props: Omit<
      OpportunityProps,
      'id' | 'tenantId' | 'ruleId' | 'ruleVersion' | 'vehicleId' | 'partyId' | 'isControlGroup'
    >,
  ) {
    super(id);
    this._status = props.status;
    this._score = props.score;
    this._valueEstimate = props.valueEstimate;
    this._evidence = { ...props.evidence };
    this._expiresAt = props.expiresAt;
    this._convertedAt = props.convertedAt;
    this._rejectionReason = props.rejectionReason;
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    tenantId: string;
    ruleId: RuleId;
    ruleVersion?: number;
    vehicleId: string;
    partyId: string;
    score: Score;
    valueEstimate?: number;
    evidence: Record<string, unknown>;
    isControlGroup: boolean;
    expiresAt?: Date;
  }): Opportunity {
    const id = props.id ?? crypto.randomUUID();
    const now = new Date();
    const version = props.ruleVersion ?? 1;

    const opp = new Opportunity(
      id,
      props.tenantId,
      props.ruleId,
      version,
      props.vehicleId,
      props.partyId,
      props.isControlGroup,
      {
        status: 'detected',
        score: props.score,
        valueEstimate: props.valueEstimate,
        evidence: props.evidence,
        expiresAt: props.expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    );

    opp.addDomainEvent(
      new OpportunityDetectedDomainEvent(
        id,
        {
          opportunityId: id,
          tenantId: props.tenantId,
          ruleId: props.ruleId,
          vehicleId: props.vehicleId,
          partyId: props.partyId,
          score: props.score.value,
          valueEstimate: props.valueEstimate ?? null,
          isControlGroup: props.isControlGroup,
          evidence: props.evidence,
        },
        now,
      ),
    );

    return opp;
  }

  static reconstitute(props: OpportunityProps): Opportunity {
    return new Opportunity(
      props.id,
      props.tenantId,
      props.ruleId,
      props.ruleVersion,
      props.vehicleId,
      props.partyId,
      props.isControlGroup,
      props,
    );
  }

  get status(): OpportunityStatus {
    return this._status;
  }

  get score(): Score {
    return this._score;
  }

  get valueEstimate(): number | undefined {
    return this._valueEstimate;
  }

  get evidence(): Record<string, unknown> {
    return { ...this._evidence };
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  get convertedAt(): Date | undefined {
    return this._convertedAt;
  }

  get rejectionReason(): string | undefined {
    return this._rejectionReason;
  }

  startProgress(): void {
    if (this._status !== 'detected') return;
    this.changeStatus('in_progress');
  }

  requestAppointment(): void {
    if (this._status === 'converted' || this._status === 'rejected' || this._status === 'expired')
      return;
    this.changeStatus('appointment_requested');
  }

  convert(convertedAt: Date = new Date()): void {
    if (this._status === 'converted') return;
    this._convertedAt = convertedAt;
    this.changeStatus('converted');

    this.addDomainEvent(
      new OpportunityConvertedDomainEvent(
        this.id,
        {
          opportunityId: this.id,
          tenantId: this.tenantId,
          vehicleId: this.vehicleId,
          partyId: this.partyId,
          valueEstimate: this._valueEstimate ?? null,
          convertedAt: convertedAt.toISOString(),
        },
        convertedAt,
      ),
    );
  }

  reject(reason: string): void {
    if (this._status === 'converted') return;
    this._rejectionReason = reason;
    this.changeStatus('rejected');
  }

  expire(): void {
    if (this._status === 'converted' || this._status === 'rejected') return;
    this.changeStatus('expired');
  }

  private changeStatus(newStatus: OpportunityStatus): void {
    const previous = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new OpportunityStatusChangedDomainEvent(
        this.id,
        {
          opportunityId: this.id,
          tenantId: this.tenantId,
          previousStatus: previous,
          newStatus,
          changedAt: this._updatedAt.toISOString(),
        },
        this._updatedAt,
      ),
    );
  }
}
