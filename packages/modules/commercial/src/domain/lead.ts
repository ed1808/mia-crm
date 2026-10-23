import { AggregateRoot, DomainError, Result, type Clock } from '@mia-crm/kernel';

export type LeadSource =
  | 'web_form'
  | 'api'
  | 'meta_lead_ads'
  | 'showroom_walk_in'
  | 'referral'
  | 'phone_inbound';

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'discarded'
  | 'duplicate';

export interface LeadProps {
  id: string;
  tenantId: string;
  branchId?: string;
  firstName: string;
  lastName?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  discardReason?: string;
  assignedTo?: string;
  partyId?: string;
  interestedVehicleModel?: string;
  notes?: string;
  slaDueAt?: Date;
  firstContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Lead extends AggregateRoot<string> {
  private props: LeadProps;

  private constructor(props: LeadProps) {
    super(props.id);
    this.props = props;
  }

  static create(
    params: {
      id?: string;
      tenantId: string;
      branchId?: string;
      firstName: string;
      lastName?: string;
      documentType?: string;
      documentNumber?: string;
      email?: string;
      phone?: string;
      source?: LeadSource;
      interestedVehicleModel?: string;
      notes?: string;
      assignedTo?: string;
      slaMinutes?: number;
    },
    clock: Clock
  ): Result<Lead, DomainError> {
    if (!params.firstName || params.firstName.trim().length === 0) {
      return Result.fail(new DomainError('INVALID_LEAD', 'El nombre del lead es obligatorio'));
    }
    if (!params.phone && !params.email) {
      return Result.fail(
        new DomainError('INVALID_LEAD', 'Debe especificarse al menos un canal de contacto (teléfono o correo)')
      );
    }

    const now = clock.now();
    const id = params.id ?? crypto.randomUUID();
    const slaMinutes = params.slaMinutes ?? 30; // Default: SLA de 30 minutos
    const slaDueAt = new Date(now.getTime() + slaMinutes * 60 * 1000);

    const lead = new Lead({
      id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      firstName: params.firstName.trim(),
      lastName: params.lastName?.trim(),
      documentType: params.documentType ?? 'CC',
      documentNumber: params.documentNumber?.trim(),
      email: params.email?.trim().toLowerCase(),
      phone: params.phone?.trim(),
      source: params.source ?? 'web_form',
      status: params.assignedTo ? 'assigned' : 'new',
      assignedTo: params.assignedTo,
      interestedVehicleModel: params.interestedVehicleModel?.trim(),
      notes: params.notes,
      slaDueAt,
      createdAt: now,
      updatedAt: now,
    });

    lead.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'LeadCreated',
      occurredAt: clock.isoNow(),
      tenantId: params.tenantId,
      payload: {
        leadId: id,
        tenantId: params.tenantId,
        firstName: lead.props.firstName,
        lastName: lead.props.lastName,
        phone: lead.props.phone,
        email: lead.props.email,
        source: lead.props.source,
        interestedVehicleModel: lead.props.interestedVehicleModel,
        slaDueAt: slaDueAt.toISOString(),
      },
    });

    return Result.ok(lead);
  }

  static reconstitute(props: LeadProps): Lead {
    return new Lead(props);
  }

  // Getters
  get tenantId(): string {
    return this.props.tenantId;
  }
  get branchId(): string | undefined {
    return this.props.branchId;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string | undefined {
    return this.props.lastName;
  }
  get fullName(): string {
    return [this.props.firstName, this.props.lastName].filter(Boolean).join(' ');
  }
  get documentType(): string | undefined {
    return this.props.documentType;
  }
  get documentNumber(): string | undefined {
    return this.props.documentNumber;
  }
  get email(): string | undefined {
    return this.props.email;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get source(): LeadSource {
    return this.props.source;
  }
  get status(): LeadStatus {
    return this.props.status;
  }
  get discardReason(): string | undefined {
    return this.props.discardReason;
  }
  get assignedTo(): string | undefined {
    return this.props.assignedTo;
  }
  get partyId(): string | undefined {
    return this.props.partyId;
  }
  get interestedVehicleModel(): string | undefined {
    return this.props.interestedVehicleModel;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get slaDueAt(): Date | undefined {
    return this.props.slaDueAt;
  }
  get firstContactedAt(): Date | undefined {
    return this.props.firstContactedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Métodos de negocio
  isSlaBreached(now: Date): boolean {
    if (this.props.firstContactedAt) {
      return this.props.slaDueAt ? this.props.firstContactedAt > this.props.slaDueAt : false;
    }
    return this.props.slaDueAt ? now > this.props.slaDueAt : false;
  }

  assignTo(userId: string, clock: Clock): void {
    this.props.assignedTo = userId;
    if (this.props.status === 'new') {
      this.props.status = 'assigned';
    }
    this.props.updatedAt = clock.now();
  }

  recordFirstContact(clock: Clock): Result<void, DomainError> {
    if (this.props.status === 'converted' || this.props.status === 'discarded') {
      return Result.fail(
        new DomainError('INVALID_STATE', `No se puede registrar contacto en un lead en estado ${this.props.status}`)
      );
    }

    const now = clock.now();
    const wasAlreadyContacted = Boolean(this.props.firstContactedAt);

    if (!wasAlreadyContacted) {
      this.props.firstContactedAt = now;
      this.props.status = 'contacted';
      this.props.updatedAt = now;

      const slaComplied = this.props.slaDueAt ? now <= this.props.slaDueAt : true;

      this.addDomainEvent({
        eventId: crypto.randomUUID(),
        eventType: 'LeadContacted',
        occurredAt: clock.isoNow(),
        tenantId: this.props.tenantId,
        payload: {
          leadId: this.id,
          tenantId: this.props.tenantId,
          contactedAt: now.toISOString(),
          slaComplied,
        },
      });
    }

    return Result.ok(undefined);
  }

  qualify(clock: Clock): Result<void, DomainError> {
    if (this.props.status === 'converted' || this.props.status === 'discarded') {
      return Result.fail(
        new DomainError('INVALID_STATE', `No se puede calificar un lead en estado ${this.props.status}`)
      );
    }
    this.props.status = 'qualified';
    this.props.updatedAt = clock.now();
    return Result.ok(undefined);
  }

  convert(partyId: string, dealId: string, clock: Clock): Result<void, DomainError> {
    if (this.props.status === 'converted') {
      return Result.fail(new DomainError('ALREADY_CONVERTED', 'El lead ya ha sido convertido previamente'));
    }
    if (this.props.status === 'discarded') {
      return Result.fail(new DomainError('INVALID_STATE', 'Un lead descartado no puede ser convertido'));
    }

    this.props.status = 'converted';
    this.props.partyId = partyId;
    this.props.updatedAt = clock.now();

    this.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'LeadConverted',
      occurredAt: clock.isoNow(),
      tenantId: this.props.tenantId,
      payload: {
        leadId: this.id,
        tenantId: this.props.tenantId,
        partyId,
        dealId,
      },
    });

    return Result.ok(undefined);
  }

  discard(reason: string, clock: Clock): Result<void, DomainError> {
    if (this.props.status === 'converted') {
      return Result.fail(new DomainError('INVALID_STATE', 'Un lead ya convertido no puede ser descartado'));
    }
    this.props.status = 'discarded';
    this.props.discardReason = reason;
    this.props.updatedAt = clock.now();
    return Result.ok(undefined);
  }
}
