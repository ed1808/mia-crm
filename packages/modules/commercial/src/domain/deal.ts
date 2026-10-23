import { AggregateRoot, DomainError, Result, type Clock } from '@mia-crm/kernel';

export type DealStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface DealProps {
  id: string;
  tenantId: string;
  branchId?: string;
  pipelineId: string;
  stageId: string;
  title: string;
  partyId: string;
  leadId?: string;
  vehicleId?: string;
  tradeInVehicleId?: string;
  assignedTo?: string;
  estimatedValue: number;
  currency: string;
  status: DealStatus;
  lossReason?: string;
  expectedCloseDate?: Date;
  wonAt?: Date;
  lostAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Deal extends AggregateRoot<string> {
  private props: DealProps;

  private constructor(props: DealProps) {
    super(props.id);
    this.props = props;
  }

  static create(
    params: {
      id?: string;
      tenantId: string;
      branchId?: string;
      pipelineId: string;
      stageId: string;
      title: string;
      partyId: string;
      leadId?: string;
      vehicleId?: string;
      tradeInVehicleId?: string;
      assignedTo?: string;
      estimatedValue?: number;
      currency?: string;
      expectedCloseDate?: Date;
    },
    clock: Clock
  ): Result<Deal, DomainError> {
    if (!params.title || params.title.trim().length === 0) {
      return Result.fail(new DomainError('INVALID_DEAL', 'El título de la oportunidad es obligatorio'));
    }
    if (!params.partyId) {
      return Result.fail(new DomainError('INVALID_DEAL', 'La oportunidad debe estar vinculada a un cliente (Party)'));
    }

    const now = clock.now();
    const id = params.id ?? crypto.randomUUID();

    const deal = new Deal({
      id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      title: params.title.trim(),
      partyId: params.partyId,
      leadId: params.leadId,
      vehicleId: params.vehicleId,
      tradeInVehicleId: params.tradeInVehicleId,
      assignedTo: params.assignedTo,
      estimatedValue: params.estimatedValue ?? 0,
      currency: params.currency ?? 'COP',
      status: 'open',
      expectedCloseDate: params.expectedCloseDate,
      createdAt: now,
      updatedAt: now,
    });

    return Result.ok(deal);
  }

  static reconstitute(props: DealProps): Deal {
    return new Deal(props);
  }

  // Getters
  get tenantId(): string {
    return this.props.tenantId;
  }
  get branchId(): string | undefined {
    return this.props.branchId;
  }
  get pipelineId(): string {
    return this.props.pipelineId;
  }
  get stageId(): string {
    return this.props.stageId;
  }
  get title(): string {
    return this.props.title;
  }
  get partyId(): string {
    return this.props.partyId;
  }
  get leadId(): string | undefined {
    return this.props.leadId;
  }
  get vehicleId(): string | undefined {
    return this.props.vehicleId;
  }
  get tradeInVehicleId(): string | undefined {
    return this.props.tradeInVehicleId;
  }
  get assignedTo(): string | undefined {
    return this.props.assignedTo;
  }
  get estimatedValue(): number {
    return this.props.estimatedValue;
  }
  get currency(): string {
    return this.props.currency;
  }
  get status(): DealStatus {
    return this.props.status;
  }
  get lossReason(): string | undefined {
    return this.props.lossReason;
  }
  get expectedCloseDate(): Date | undefined {
    return this.props.expectedCloseDate;
  }
  get wonAt(): Date | undefined {
    return this.props.wonAt;
  }
  get lostAt(): Date | undefined {
    return this.props.lostAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  moveToStage(
    params: {
      newStageId: string;
      isWon: boolean;
      isLost: boolean;
      lossReason?: string;
    },
    clock: Clock
  ): Result<void, DomainError> {
    if (this.props.status === 'won' && !params.isWon) {
      return Result.fail(new DomainError('ALREADY_WON', 'No se puede modificar una oportunidad ya ganada'));
    }

    const previousStageId = this.props.stageId;
    const now = clock.now();

    this.props.stageId = params.newStageId;
    this.props.updatedAt = now;

    if (params.isWon) {
      this.props.status = 'won';
      this.props.wonAt = now;
    } else if (params.isLost) {
      this.props.status = 'lost';
      this.props.lostAt = now;
      this.props.lossReason = params.lossReason ?? 'No especificado';
    } else {
      this.props.status = 'open';
    }

    this.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'DealStageChanged',
      occurredAt: clock.isoNow(),
      tenantId: this.props.tenantId,
      payload: {
        dealId: this.id,
        tenantId: this.props.tenantId,
        previousStageId,
        newStageId: params.newStageId,
        status: this.props.status,
      },
    });

    return Result.ok(undefined);
  }

  updateEstimatedValue(amount: number, clock: Clock): void {
    this.props.estimatedValue = Math.max(0, amount);
    this.props.updatedAt = clock.now();
  }

  linkVehicle(vehicleId: string, clock: Clock): void {
    this.props.vehicleId = vehicleId;
    this.props.updatedAt = clock.now();
  }

  linkTradeInVehicle(tradeInVehicleId: string, clock: Clock): void {
    this.props.tradeInVehicleId = tradeInVehicleId;
    this.props.updatedAt = clock.now();
  }
}
