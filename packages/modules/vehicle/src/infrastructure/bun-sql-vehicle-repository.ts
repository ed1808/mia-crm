import type { SQL } from 'bun';
import { Vehicle, type PlateHistoryEntry, type VehicleRelationshipEntry } from '../domain/vehicle';
import type { VehicleRepository } from '../domain/vehicle-repository';
import {
  Plate,
  Vin,
  Mileage,
  OperatingHours,
  SharePercentage,
  type VehicleType,
  type RelationshipRole,
} from '../domain/value-objects';

export class BunSqlVehicleRepository implements VehicleRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Vehicle | null> {
    const rows = await this.sql<
      {
        id: string;
        tenant_id: string;
        external_code: string | null;
        vin: string | null;
        current_plate: string | null;
        make: string;
        model: string;
        model_year: number | null;
        color: string | null;
        engine_number: string | null;
        vehicle_type: string;
        current_mileage: number | null;
        current_operating_hours: number | null;
        warranty_end_date: string | null;
        rtm_due_date: string | null;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT
        id, tenant_id, external_code, vin, current_plate, make, model,
        model_year, color, engine_number, vehicle_type, current_mileage,
        current_operating_hours, warranty_end_date, rtm_due_date,
        created_at, updated_at
      FROM vehicles
      WHERE id = ${id}::uuid
    `;

    const row = rows[0];
    if (!row) return null;

    const vinVo = row.vin ? Vin.create(row.vin) : null;
    const plateVo = row.current_plate ? Plate.create(row.current_plate) : null;
    const mileageVo = row.current_mileage !== null ? Mileage.create(row.current_mileage) : null;
    const opHoursVo =
      row.current_operating_hours !== null
        ? OperatingHours.create(row.current_operating_hours)
        : null;

    // Consultar historial de placas
    const plateRows = await this.sql<
      {
        id: string;
        plate: string;
        valid_from: Date;
        valid_to: Date | null;
      }[]
    >`
      SELECT id, plate, valid_from, valid_to
      FROM plate_history
      WHERE vehicle_id = ${id}::uuid
      ORDER BY valid_from ASC
    `;

    const plateHistory: PlateHistoryEntry[] = plateRows
      .map((pr) => {
        const pVo = Plate.create(pr.plate);
        if (!pVo.ok) return null;
        return {
          id: pr.id,
          plate: pVo.value,
          validFrom: pr.valid_from,
          validTo: pr.valid_to ?? undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Consultar relaciones (propietarios, conductores, flotas)
    const relRows = await this.sql<
      {
        id: string;
        party_id: string;
        role: string;
        share_percentage: string;
        is_primary: boolean;
        valid_from: Date;
        valid_to: Date | null;
      }[]
    >`
      SELECT id, party_id, role, share_percentage, is_primary, valid_from, valid_to
      FROM vehicle_relationships
      WHERE vehicle_id = ${id}::uuid
      ORDER BY valid_from ASC
    `;

    const relationships: VehicleRelationshipEntry[] = relRows
      .map((rr) => {
        const shareVo = SharePercentage.create(Number(rr.share_percentage));
        if (!shareVo.ok) return null;
        return {
          id: rr.id,
          partyId: rr.party_id,
          role: rr.role as RelationshipRole,
          sharePercentage: shareVo.value,
          isPrimary: rr.is_primary,
          validFrom: rr.valid_from,
          validTo: rr.valid_to ?? undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return Vehicle.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      externalCode: row.external_code ?? undefined,
      vin: vinVo && vinVo.ok ? vinVo.value : undefined,
      currentPlate: plateVo && plateVo.ok ? plateVo.value : undefined,
      make: row.make,
      model: row.model,
      modelYear: row.model_year ?? undefined,
      color: row.color ?? undefined,
      engineNumber: row.engine_number ?? undefined,
      vehicleType: (row.vehicle_type || 'passenger') as VehicleType,
      currentMileage: mileageVo && mileageVo.ok ? mileageVo.value : undefined,
      currentOperatingHours: opHoursVo && opHoursVo.ok ? opHoursVo.value : undefined,
      warrantyEndDate: row.warranty_end_date ? new Date(row.warranty_end_date) : undefined,
      rtmDueDate: row.rtm_due_date ? new Date(row.rtm_due_date) : undefined,
      plateHistory,
      relationships,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findByVin(vin: string): Promise<Vehicle | null> {
    const cleaned = vin
      .replace(/[\s\-]/g, '')
      .trim()
      .toUpperCase();
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM vehicles WHERE vin = ${cleaned} LIMIT 1
    `;
    if (!rows[0]) return null;
    return await this.findById(rows[0].id);
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const cleaned = plate
      .replace(/[\s\-]/g, '')
      .trim()
      .toUpperCase();
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM vehicles WHERE current_plate = ${cleaned} LIMIT 1
    `;
    if (!rows[0]) return null;
    return await this.findById(rows[0].id);
  }

  async findByExternalCode(code: string): Promise<Vehicle | null> {
    const trimmed = code.trim();
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM vehicles WHERE external_code = ${trimmed} LIMIT 1
    `;
    if (!rows[0]) return null;
    return await this.findById(rows[0].id);
  }

  async save(vehicle: Vehicle): Promise<void> {
    const vinVal = vehicle.vin ? vehicle.vin.value : null;
    const plateVal = vehicle.currentPlate ? vehicle.currentPlate.value : null;
    const mileageVal = vehicle.currentMileage ? vehicle.currentMileage.value : null;
    const opHoursVal = vehicle.currentOperatingHours ? vehicle.currentOperatingHours.value : null;
    const warrantyVal = vehicle.warrantyEndDate
      ? vehicle.warrantyEndDate.toISOString().split('T')[0]
      : null;
    const rtmVal = vehicle.rtmDueDate ? vehicle.rtmDueDate.toISOString().split('T')[0] : null;

    // 1. Guardar o actualizar registro en vehicles
    await this.sql`
      INSERT INTO vehicles (
        id, tenant_id, external_code, vin, current_plate, make, model,
        model_year, color, engine_number, vehicle_type, current_mileage,
        current_operating_hours, warranty_end_date, rtm_due_date, updated_at
      ) VALUES (
        ${vehicle.id}::uuid,
        ${vehicle.tenantId}::uuid,
        ${vehicle.externalCode ?? null},
        ${vinVal},
        ${plateVal},
        ${vehicle.make},
        ${vehicle.model},
        ${vehicle.modelYear ?? null},
        ${vehicle.color ?? null},
        ${vehicle.engineNumber ?? null},
        ${vehicle.vehicleType},
        ${mileageVal},
        ${opHoursVal},
        ${warrantyVal}::date,
        ${rtmVal}::date,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        external_code = EXCLUDED.external_code,
        vin = EXCLUDED.vin,
        current_plate = EXCLUDED.current_plate,
        make = EXCLUDED.make,
        model = EXCLUDED.model,
        model_year = EXCLUDED.model_year,
        color = EXCLUDED.color,
        engine_number = EXCLUDED.engine_number,
        vehicle_type = EXCLUDED.vehicle_type,
        current_mileage = EXCLUDED.current_mileage,
        current_operating_hours = EXCLUDED.current_operating_hours,
        warranty_end_date = EXCLUDED.warranty_end_date,
        rtm_due_date = EXCLUDED.rtm_due_date,
        updated_at = NOW()
    `;

    // 2. Guardar historial de placas
    for (const ph of vehicle.plateHistory) {
      await this.sql`
        INSERT INTO plate_history (id, tenant_id, vehicle_id, plate, valid_from, valid_to)
        VALUES (
          ${ph.id}::uuid,
          ${vehicle.tenantId}::uuid,
          ${vehicle.id}::uuid,
          ${ph.plate.value},
          ${ph.validFrom.toISOString()}::timestamptz,
          ${ph.validTo ? ph.validTo.toISOString() : null}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          valid_to = EXCLUDED.valid_to
      `;
    }

    // 3. Guardar relaciones (propiedad, copropiedad, etc.)
    for (const rel of vehicle.relationships) {
      await this.sql`
        INSERT INTO vehicle_relationships (
          id, tenant_id, vehicle_id, party_id, role,
          share_percentage, is_primary, valid_from, valid_to
        ) VALUES (
          ${rel.id}::uuid,
          ${vehicle.tenantId}::uuid,
          ${vehicle.id}::uuid,
          ${rel.partyId}::uuid,
          ${rel.role},
          ${rel.sharePercentage.value},
          ${rel.isPrimary},
          ${rel.validFrom.toISOString()}::timestamptz,
          ${rel.validTo ? rel.validTo.toISOString() : null}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          is_primary = EXCLUDED.is_primary,
          valid_to = EXCLUDED.valid_to
      `;
    }

    // 4. Persistir eventos de dominio pendientes al Outbox (D-23)
    for (const event of vehicle.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload
        ) VALUES (
          ${vehicle.tenantId}::uuid,
          ${event.eventType},
          'Vehicle',
          ${vehicle.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }

    vehicle.clearDomainEvents();
  }
}
