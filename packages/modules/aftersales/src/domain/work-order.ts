import { AggregateRoot } from '@mia-crm/kernel';
import type { OrderType, OrderStatus } from './value-objects';
import { WorkOrderOpenedDomainEvent, WorkOrderCompletedDomainEvent } from './events';

export interface WorkOrderProps {
  id: string;
  tenantId: string;
  externalId: string;
  vehicleId: string;
  partyId: string;
  orderNumber: number;
  branchCode: number;
  orderType: OrderType;
  status: OrderStatus;
  mileage?: number;
  operatingHours?: number;
  enteredAt: Date;
  promisedDeliveryAt?: Date;
  closedAt?: Date;
  insuranceCompanyNit?: string;
  isBilled: boolean;
  isVoided: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkOrder extends AggregateRoot<string> {
  private _status: OrderStatus;
  private _mileage?: number;
  private _operatingHours?: number;
  private _enteredAt: Date;
  private _promisedDeliveryAt?: Date;
  private _closedAt?: Date;
  private _insuranceCompanyNit?: string;
  private _isBilled: boolean;
  private _isVoided: boolean;
  private _updatedAt: Date;

  private constructor(
    id: string,
    readonly tenantId: string,
    readonly externalId: string,
    readonly vehicleId: string,
    readonly partyId: string,
    readonly orderNumber: number,
    readonly branchCode: number,
    readonly orderType: OrderType,
    props: Omit<
      WorkOrderProps,
      | 'id'
      | 'tenantId'
      | 'externalId'
      | 'vehicleId'
      | 'partyId'
      | 'orderNumber'
      | 'branchCode'
      | 'orderType'
    >,
  ) {
    super(id);
    this._status = props.status;
    this._mileage = props.mileage;
    this._operatingHours = props.operatingHours;
    this._enteredAt = props.enteredAt;
    this._promisedDeliveryAt = props.promisedDeliveryAt;
    this._closedAt = props.closedAt;
    this._insuranceCompanyNit = props.insuranceCompanyNit;
    this._isBilled = props.isBilled;
    this._isVoided = props.isVoided;
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    tenantId: string;
    externalId: string;
    vehicleId: string;
    partyId: string;
    orderNumber: number;
    branchCode: number;
    orderType: OrderType;
    status?: OrderStatus;
    mileage?: number;
    operatingHours?: number;
    enteredAt: Date;
    promisedDeliveryAt?: Date;
    closedAt?: Date;
    insuranceCompanyNit?: string;
    isBilled?: boolean;
    isVoided?: boolean;
  }): WorkOrder {
    const id = props.id ?? crypto.randomUUID();
    const now = new Date();
    const initialStatus = props.status ?? 'opened';

    const wo = new WorkOrder(
      id,
      props.tenantId,
      props.externalId,
      props.vehicleId,
      props.partyId,
      props.orderNumber,
      props.branchCode,
      props.orderType,
      {
        status: initialStatus,
        mileage: props.mileage,
        operatingHours: props.operatingHours,
        enteredAt: props.enteredAt,
        promisedDeliveryAt: props.promisedDeliveryAt,
        closedAt: props.closedAt,
        insuranceCompanyNit: props.insuranceCompanyNit,
        isBilled: props.isBilled ?? false,
        isVoided: props.isVoided ?? false,
        createdAt: now,
        updatedAt: now,
      },
    );

    wo.addDomainEvent(
      new WorkOrderOpenedDomainEvent(
        id,
        {
          workOrderId: id,
          tenantId: props.tenantId,
          vehicleId: props.vehicleId,
          partyId: props.partyId,
          orderNumber: props.orderNumber,
          branchCode: props.branchCode,
          orderType: props.orderType,
          mileage: props.mileage ?? null,
          enteredAt: props.enteredAt.toISOString(),
        },
        now,
      ),
    );

    if (props.closedAt || initialStatus === 'completed') {
      wo.complete(props.closedAt ?? now);
    }

    return wo;
  }

  static reconstitute(props: WorkOrderProps): WorkOrder {
    return new WorkOrder(
      props.id,
      props.tenantId,
      props.externalId,
      props.vehicleId,
      props.partyId,
      props.orderNumber,
      props.branchCode,
      props.orderType,
      props,
    );
  }

  get status(): OrderStatus {
    return this._status;
  }

  get mileage(): number | undefined {
    return this._mileage;
  }

  get operatingHours(): number | undefined {
    return this._operatingHours;
  }

  get enteredAt(): Date {
    return this._enteredAt;
  }

  get promisedDeliveryAt(): Date | undefined {
    return this._promisedDeliveryAt;
  }

  get insuranceCompanyNit(): string | undefined {
    return this._insuranceCompanyNit;
  }

  get closedAt(): Date | undefined {
    return this._closedAt;
  }

  get isBilled(): boolean {
    return this._isBilled;
  }

  get isVoided(): boolean {
    return this._isVoided;
  }

  complete(closedAt: Date = new Date()): void {
    this._status = 'completed';
    this._closedAt = closedAt;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new WorkOrderCompletedDomainEvent(
        this.id,
        {
          workOrderId: this.id,
          tenantId: this.tenantId,
          vehicleId: this.vehicleId,
          partyId: this.partyId,
          orderNumber: this.orderNumber,
          orderType: this.orderType,
          mileage: this._mileage ?? null,
          closedAt: closedAt.toISOString(),
        },
        closedAt,
      ),
    );
  }

  voidOrder(): void {
    this._status = 'voided';
    this._isVoided = true;
    this._updatedAt = new Date();
  }

  billOrder(): void {
    this._isBilled = true;
    this._updatedAt = new Date();
  }
}
