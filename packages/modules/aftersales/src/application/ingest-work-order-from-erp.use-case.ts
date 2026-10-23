import { Result, DomainError } from '@mia-crm/kernel';
import { WorkOrder } from '../domain/work-order';
import type { OrderType, OrderStatus } from '../domain/value-objects';
import type { WorkOrderRepository } from '../domain/work-order-repository';

export interface IngestWorkOrderFromErpDto {
  tenantId: string;
  externalId: string;
  bodega: number;
  orderNumber: number;
  vehicleId: string;
  partyId: string;
  orderType: OrderType;
  status: string;
  mileage: number | null;
  operatingHours: number | null;
  insuranceCompanyNit: string | null;
  isBilled: boolean;
  isVoided: boolean;
  promisedDeliveryAt: string | null;
  enteredAt: string;
}

export class IngestWorkOrderFromErpUseCase {
  constructor(private readonly workOrderRepo: WorkOrderRepository) {}

  async execute(
    dto: IngestWorkOrderFromErpDto,
  ): Promise<Result<{ workOrderId: string; isNew: boolean }, DomainError>> {
    let order = await this.workOrderRepo.findByExternalId(dto.externalId);
    let isNew = false;

    const enteredDate = new Date(dto.enteredAt);
    const promisedDate = dto.promisedDeliveryAt ? new Date(dto.promisedDeliveryAt) : undefined;

    // Normalizar status
    const rawStatus = dto.status.toLowerCase();
    let orderStatus: OrderStatus = 'opened';
    if (dto.isVoided || rawStatus.includes('anul')) {
      orderStatus = 'voided';
    } else if (rawStatus.includes('comp') || rawStatus.includes('cerr') || rawStatus === 'c') {
      orderStatus = 'completed';
    } else if (dto.isBilled || rawStatus.includes('fact')) {
      orderStatus = 'billed';
    } else if (rawStatus.includes('proc') || rawStatus.includes('prog')) {
      orderStatus = 'in_progress';
    }

    if (order) {
      if (
        (orderStatus === 'completed' || orderStatus === 'billed') &&
        order.status !== 'completed'
      ) {
        order.complete();
      }
      if (dto.isVoided && !order.isVoided) {
        order.voidOrder();
      }
      if (dto.isBilled && !order.isBilled) {
        order.billOrder();
      }
    } else {
      isNew = true;
      order = WorkOrder.create({
        tenantId: dto.tenantId,
        externalId: dto.externalId,
        vehicleId: dto.vehicleId,
        partyId: dto.partyId,
        orderNumber: dto.orderNumber,
        branchCode: dto.bodega,
        orderType: dto.orderType,
        status: orderStatus,
        mileage: dto.mileage ?? undefined,
        operatingHours: dto.operatingHours ?? undefined,
        enteredAt: enteredDate,
        promisedDeliveryAt: promisedDate,
        insuranceCompanyNit: dto.insuranceCompanyNit ?? undefined,
        isBilled: dto.isBilled,
        isVoided: dto.isVoided,
      });
    }

    await this.workOrderRepo.save(order);

    return Result.ok({ workOrderId: order.id, isNew });
  }
}
