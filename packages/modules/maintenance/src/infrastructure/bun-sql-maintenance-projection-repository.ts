import type { SQL } from 'bun';
import { NextVisitProjection } from '../domain/next-visit-projection';
import type { MaintenanceProjectionRepository } from '../domain/maintenance-projection-repository';
import type { ProjectionMethod, ConfidenceLevel } from '../domain/value-objects';

export class BunSqlMaintenanceProjectionRepository implements MaintenanceProjectionRepository {
  constructor(private readonly sql: SQL) {}

  async findByVehicleId(vehicleId: string): Promise<NextVisitProjection | null> {
    const rows = await this.sql<
      {
        id: string;
        tenant_id: string;
        vehicle_id: string;
        projected_date: string;
        projected_mileage: number | null;
        projection_method: string;
        confidence_level: string;
        calculation_basis: Record<string, unknown>;
        calculated_at: Date;
      }[]
    >`
      SELECT
        id, tenant_id, vehicle_id, projected_date, projected_mileage,
        projection_method, confidence_level, calculation_basis, calculated_at
      FROM next_visit_projections
      WHERE vehicle_id = ${vehicleId}::uuid
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    const rawBasis = row.calculation_basis;
    const basis = typeof rawBasis === 'string' ? JSON.parse(rawBasis) : rawBasis;

    return NextVisitProjection.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      vehicleId: row.vehicle_id,
      projectedDate: new Date(row.projected_date),
      projectedMileage: row.projected_mileage ?? undefined,
      projectionMethod: row.projection_method as ProjectionMethod,
      confidenceLevel: row.confidence_level as ConfidenceLevel,
      calculationBasis: basis,
      calculatedAt: row.calculated_at,
    });
  }

  async save(projection: NextVisitProjection): Promise<void> {
    const projectedDateStr = projection.projectedDate.toISOString().split('T')[0]!;
    const basisJson = JSON.stringify(projection.calculationBasis);

    await this.sql`
      INSERT INTO next_visit_projections (
        id, tenant_id, vehicle_id, projected_date, projected_mileage,
        projection_method, confidence_level, calculation_basis, calculated_at
      ) VALUES (
        ${projection.id}::uuid,
        ${projection.tenantId}::uuid,
        ${projection.vehicleId}::uuid,
        ${projectedDateStr}::date,
        ${projection.projectedMileage ?? null},
        ${projection.projectionMethod},
        ${projection.confidenceLevel},
        ${basisJson}::jsonb,
        ${projection.calculatedAt.toISOString()}::timestamptz
      )
      ON CONFLICT (tenant_id, vehicle_id) DO UPDATE SET
        projected_date = EXCLUDED.projected_date,
        projected_mileage = EXCLUDED.projected_mileage,
        projection_method = EXCLUDED.projection_method,
        confidence_level = EXCLUDED.confidence_level,
        calculation_basis = EXCLUDED.calculation_basis,
        calculated_at = EXCLUDED.calculated_at
    `;

    for (const event of projection.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload
        ) VALUES (
          ${projection.tenantId}::uuid,
          ${event.eventType},
          'NextVisitProjection',
          ${projection.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }

    projection.clearDomainEvents();
  }
}
