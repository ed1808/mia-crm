import type { SQL } from 'bun';
import { WorkOrder } from '../domain/work-order';
import type { WorkOrderRepository } from '../domain/work-order-repository';
import type { OrderType, OrderStatus } from '../domain/value-objects';

export class BunSqlWorkOrderRepository implements WorkOrderRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<WorkOrder | null> {
    const rows = await this.sql<
      {
        id: string;
        tenant_id: string;
        external_id: string;
        vehicle_id: string;
        party_id: string;
        order_number: number;
        branch_code: number;
        order_type: string;
        status: string;
        mileage: number | null;
        operating_hours: number | null;
        entered_at: Date;
        promised_delivery_at: Date | null;
        closed_at: Date | null;
        insurance_company_nit: string | null;
        is_billed: boolean;
        is_voided: boolean;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT
        id, tenant_id, external_id, vehicle_id, party_id, order_number,
        branch_code, order_type, status, mileage, operating_hours,
        entered_at, promised_delivery_at, closed_at, insurance_company_nit,
        is_billed, is_voided, created_at, updated_at
      FROM work_orders
      WHERE id = ${id}::uuid
    `;

    const row = rows[0];
    if (!row) return null;

    return WorkOrder.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      externalId: row.external_id,
      vehicleId: row.vehicle_id,
      partyId: row.party_id,
      orderNumber: row.order_number,
      branchCode: row.branch_code,
      orderType: row.order_type as OrderType,
      status: row.status as OrderStatus,
      mileage: row.mileage ?? undefined,
      operatingHours: row.operating_hours ?? undefined,
      enteredAt: row.entered_at,
      promisedDeliveryAt: row.promised_delivery_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
      insuranceCompanyNit: row.insurance_company_nit ?? undefined,
      isBilled: row.is_billed,
      isVoided: row.is_voided,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findByExternalId(externalId: string): Promise<WorkOrder | null> {
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM work_orders WHERE external_id = ${externalId} LIMIT 1
    `;
    if (!rows[0]) return null;
    return await this.findById(rows[0].id);
  }

  async findByVehicleId(vehicleId: string): Promise<WorkOrder[]> {
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM work_orders
      WHERE vehicle_id = ${vehicleId}::uuid
      ORDER BY entered_at ASC
    `;

    const orders: WorkOrder[] = [];
    for (const r of rows) {
      const o = await this.findById(r.id);
      if (o) orders.push(o);
    }
    return orders;
  }

  async save(order: WorkOrder): Promise<void> {
    await this.sql`
      INSERT INTO work_orders (
        id, tenant_id, external_id, vehicle_id, party_id, order_number,
        branch_code, order_type, status, mileage, operating_hours,
        entered_at, promised_delivery_at, closed_at, insurance_company_nit,
        is_billed, is_voided, updated_at
      ) VALUES (
        ${order.id}::uuid,
        ${order.tenantId}::uuid,
        ${order.externalId},
        ${order.vehicleId}::uuid,
        ${order.partyId}::uuid,
        ${order.orderNumber},
        ${order.branchCode},
        ${order.orderType},
        ${order.status},
        ${order.mileage ?? null},
        ${order.operatingHours ?? null},
        ${order.enteredAt.toISOString()}::timestamptz,
        ${order.promisedDeliveryAt ? order.promisedDeliveryAt.toISOString() : null}::timestamptz,
        ${order.closedAt ? order.closedAt.toISOString() : null}::timestamptz,
        ${order.insuranceCompanyNit ?? null},
        ${order.isBilled},
        ${order.isVoided},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        mileage = EXCLUDED.mileage,
        operating_hours = EXCLUDED.operating_hours,
        closed_at = EXCLUDED.closed_at,
        is_billed = EXCLUDED.is_billed,
        is_voided = EXCLUDED.is_voided,
        updated_at = NOW()
    `;

    for (const event of order.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload
        ) VALUES (
          ${order.tenantId}::uuid,
          ${event.eventType},
          'WorkOrder',
          ${order.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }

    order.clearDomainEvents();
  }
}
