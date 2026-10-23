import { AggregateRoot, DomainError, Result, type Clock } from '@mia-crm/kernel';

export type SaleStatus = 'pending_delivery' | 'completed' | 'cancelled';

export interface SaleProps {
  id: string;
  tenantId: string;
  branchId?: string;
  dealId?: string;
  quoteId?: string;
  vehicleId: string;
  customerPartyId: string;
  externalOrderNumber?: string;
  externalInvoiceNumber?: string;
  saleAmount: number;
  saleDate: Date;
  deliveryDate?: Date;
  status: SaleStatus;
  reconciledAt: Date;
}

export class Sale extends AggregateRoot<string> {
  private props: SaleProps;

  private constructor(props: SaleProps) {
    super(props.id);
    this.props = props;
  }

  static create(
    params: {
      id?: string;
      tenantId: string;
      branchId?: string;
      dealId?: string;
      quoteId?: string;
      vehicleId: string;
      customerPartyId: string;
      externalOrderNumber?: string;
      externalInvoiceNumber?: string;
      saleAmount: number;
      saleDate: Date;
      deliveryDate?: Date;
      status?: SaleStatus;
    },
    clock: Clock
  ): Result<Sale, DomainError> {
    if (!params.vehicleId) {
      return Result.fail(new DomainError('INVALID_SALE', 'La venta debe estar asociada a un vehículo'));
    }
    if (!params.customerPartyId) {
      return Result.fail(new DomainError('INVALID_SALE', 'La venta debe estar asociada a un cliente (Party)'));
    }
    if (params.saleAmount <= 0) {
      return Result.fail(new DomainError('INVALID_SALE', 'El valor de la venta debe ser mayor a cero'));
    }

    const now = clock.now();
    const id = params.id ?? crypto.randomUUID();

    const sale = new Sale({
      id,
      tenantId: params.tenantId,
      branchId: params.branchId,
      dealId: params.dealId,
      quoteId: params.quoteId,
      vehicleId: params.vehicleId,
      customerPartyId: params.customerPartyId,
      externalOrderNumber: params.externalOrderNumber,
      externalInvoiceNumber: params.externalInvoiceNumber,
      saleAmount: params.saleAmount,
      saleDate: params.saleDate,
      deliveryDate: params.deliveryDate,
      status: params.status ?? (params.deliveryDate ? 'completed' : 'pending_delivery'),
      reconciledAt: now,
    });

    sale.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'SaleReconciled',
      occurredAt: clock.isoNow(),
      tenantId: params.tenantId,
      payload: {
        saleId: id,
        tenantId: params.tenantId,
        dealId: params.dealId,
        quoteId: params.quoteId,
        vehicleId: params.vehicleId,
        customerPartyId: params.customerPartyId,
        externalOrderNumber: params.externalOrderNumber,
        externalInvoiceNumber: params.externalInvoiceNumber,
        saleAmount: params.saleAmount,
        deliveryDate: params.deliveryDate?.toISOString(),
      },
    });

    return Result.ok(sale);
  }

  static reconstitute(props: SaleProps): Sale {
    return new Sale(props);
  }

  // Getters
  get tenantId(): string {
    return this.props.tenantId;
  }
  get branchId(): string | undefined {
    return this.props.branchId;
  }
  get dealId(): string | undefined {
    return this.props.dealId;
  }
  get quoteId(): string | undefined {
    return this.props.quoteId;
  }
  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get customerPartyId(): string {
    return this.props.customerPartyId;
  }
  get externalOrderNumber(): string | undefined {
    return this.props.externalOrderNumber;
  }
  get externalInvoiceNumber(): string | undefined {
    return this.props.externalInvoiceNumber;
  }
  get saleAmount(): number {
    return this.props.saleAmount;
  }
  get saleDate(): Date {
    return this.props.saleDate;
  }
  get deliveryDate(): Date | undefined {
    return this.props.deliveryDate;
  }
  get status(): SaleStatus {
    return this.props.status;
  }
  get reconciledAt(): Date {
    return this.props.reconciledAt;
  }

  markDelivered(deliveryDate: Date): void {
    this.props.deliveryDate = deliveryDate;
    this.props.status = 'completed';
  }
}
