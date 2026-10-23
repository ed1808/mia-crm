import type { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { ErpTranslators, type ErpWebhookEvent } from '@mia-crm/erp-acl';
import { BunSqlPartyRepository, UpsertPartyFromErpUseCase } from '@mia-crm/module-party';
import {
  BunSqlVehicleRepository,
  UpsertVehicleFromErpUseCase,
  Mileage,
} from '@mia-crm/module-vehicle';
import {
  BunSqlWorkOrderRepository,
  IngestWorkOrderFromErpUseCase,
} from '@mia-crm/module-aftersales';
import {
  BunSqlMaintenanceProjectionRepository,
  ProjectVehicleNextVisitUseCase,
} from '@mia-crm/module-maintenance';
import {
  BunSqlOpportunityRepository,
  DetectOpportunitiesUseCase,
} from '@mia-crm/module-opportunity';

export interface InboxProcessorResult {
  processed: number;
  failed: number;
  skipped: number;
}

export class InboxProcessor {
  constructor(private readonly sql: SQL) {}

  async processPendingBatch(batchSize = 25): Promise<InboxProcessorResult> {
    // 1. Obtener lote de eventos pendientes en inbox_events mediante función segura
    const pendingEvents = await this.sql<
      {
        id: string;
        tenant_id: string;
        event_id: string;
        source_table: string;
        operation: 'INSERT' | 'UPDATE' | 'DELETE';
        payload: Record<string, unknown>;
        captured_at: string;
      }[]
    >`
      SELECT id, tenant_id, event_id, source_table, operation, payload, captured_at
      FROM get_pending_inbox_events(${batchSize})
    `;

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const evt of pendingEvents) {
      try {
        const rawPayload = evt.payload;
        const parsedPayload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

        await withTenant(this.sql, { tenantId: evt.tenant_id }, async (tx) => {
          const webhookEvent: ErpWebhookEvent = {
            event_id: evt.event_id,
            source_table: evt.source_table,
            operation: evt.operation,
            captured_at: evt.captured_at,
            payload: parsedPayload as {
              after?: Record<string, unknown>;
              before?: Record<string, unknown>;
            },
          };

          if (evt.source_table === 'terceros') {
            const canonicalParty = ErpTranslators.translateTerceros(webhookEvent);
            if (!canonicalParty) {
              skipped++;
              await tx`
                UPDATE inbox_events
                SET status = 'processed', error_message = 'Fila ignorada por falta de NIT o datos incompletos', processed_at = NOW()
                WHERE id = ${evt.id}::uuid
              `;
              return;
            }

            const partyRepo = new BunSqlPartyRepository(tx);
            const useCase = new UpsertPartyFromErpUseCase(partyRepo);

            const result = await useCase.execute({
              tenantId: evt.tenant_id,
              documentType: canonicalParty.documentType,
              documentNumber: canonicalParty.documentNumber,
              fullName: canonicalParty.fullName,
              email: canonicalParty.email,
              phone: canonicalParty.phone,
              isCompany: canonicalParty.isCompany,
            });

            if (!result.ok) {
              if (result.error.code === 'PARTY_SUPPRESSED') {
                // Registro suprimido por Ley 1581 (D-31, D-32): registrar y descartar
                await tx`
                  UPDATE inbox_events
                  SET status = 'processed', error_message = 'Titular suprimido bajo Ley 1581. Reingesta bloqueada.', processed_at = NOW()
                  WHERE id = ${evt.id}::uuid
                `;
                processed++;
                return;
              }
              throw new Error(result.error.message);
            }

            processed++;
            await tx`
              UPDATE inbox_events
              SET status = 'processed', processed_at = NOW()
              WHERE id = ${evt.id}::uuid
            `;
          } else if (evt.source_table === 'referencias_imp') {
            const canonicalVehicle = ErpTranslators.translateReferenciasImp(webhookEvent);
            if (!canonicalVehicle) {
              skipped++;
              await tx`
                UPDATE inbox_events
                SET status = 'processed', error_message = 'Fila de vehículo ignorada por falta de código', processed_at = NOW()
                WHERE id = ${evt.id}::uuid
              `;
              return;
            }

            // Resolver propietario si el NIT del comprador viene informado
            let ownerPartyId: string | null = null;
            if (canonicalVehicle.ownerNit) {
              const cleanedNit = canonicalVehicle.ownerNit
                .replace(/[.\-\s]/g, '')
                .trim()
                .toUpperCase();
              const ownerRows = await tx<{ party_id: string }[]>`
                SELECT party_id FROM party_identifiers
                WHERE id_number = ${cleanedNit}
                LIMIT 1
              `;
              if (ownerRows[0]) {
                ownerPartyId = ownerRows[0].party_id;
              }
            }

            const vehicleRepo = new BunSqlVehicleRepository(tx);
            const useCase = new UpsertVehicleFromErpUseCase(vehicleRepo);

            const result = await useCase.execute({
              tenantId: evt.tenant_id,
              externalCode: canonicalVehicle.externalId,
              vin: canonicalVehicle.vin,
              plate: canonicalVehicle.plate,
              make: canonicalVehicle.make,
              model: canonicalVehicle.model,
              modelYear: canonicalVehicle.modelYear,
              color: canonicalVehicle.color,
              engineNumber: canonicalVehicle.engineNumber,
              mileage: canonicalVehicle.mileage,
              operatingHours: canonicalVehicle.operatingHours,
              warrantyEndDate: canonicalVehicle.warrantyEndDate,
              rtmDueDate: canonicalVehicle.technicalInspectionDate,
              ownerPartyId,
            });

            if (!result.ok) {
              throw new Error(result.error.message);
            }

            processed++;
            await tx`
              UPDATE inbox_events
              SET status = 'processed', processed_at = NOW()
              WHERE id = ${evt.id}::uuid
            `;
          } else if (evt.source_table === 'tall_encabeza_orden') {
            const canonicalOrder = ErpTranslators.translateWorkOrder(webhookEvent);
            if (!canonicalOrder) {
              skipped++;
              await tx`
                UPDATE inbox_events
                SET status = 'processed', error_message = 'Fila de orden ignorada por falta de número o bodega', processed_at = NOW()
                WHERE id = ${evt.id}::uuid
              `;
              return;
            }

            // 1. Resolver vehículo por código de serie, chasis o placa
            const vehicleRepo = new BunSqlVehicleRepository(tx);
            let vehicle = await vehicleRepo.findByExternalCode(canonicalOrder.vehicleCode);
            if (!vehicle) {
              vehicle = await vehicleRepo.findByVin(canonicalOrder.vehicleCode);
            }
            if (!vehicle) {
              vehicle = await vehicleRepo.findByPlate(canonicalOrder.vehicleCode);
            }

            if (!vehicle) {
              throw new Error(`Vehículo no encontrado para la OT: ${canonicalOrder.vehicleCode}`);
            }

            // 2. Resolver titular por NIT
            const partyRepo = new BunSqlPartyRepository(tx);
            const party =
              (await partyRepo.findByIdentifier('NIT', canonicalOrder.clientNit)) ??
              (await partyRepo.findByIdentifier('CC', canonicalOrder.clientNit));

            const partyId = party ? party.id : vehicle.primaryOwner?.partyId;
            if (!partyId) {
              throw new Error(
                `Titular o propietario no encontrado para la OT: NIT ${canonicalOrder.clientNit}`,
              );
            }

            // 3. Ingestar la orden de trabajo en Aftersales
            const woRepo = new BunSqlWorkOrderRepository(tx);
            const ingestWoUseCase = new IngestWorkOrderFromErpUseCase(woRepo);

            const woResult = await ingestWoUseCase.execute({
              tenantId: evt.tenant_id,
              externalId: canonicalOrder.externalId,
              bodega: canonicalOrder.bodega,
              orderNumber: canonicalOrder.orderNumber,
              vehicleId: vehicle.id,
              partyId,
              orderType: canonicalOrder.orderType,
              status: canonicalOrder.status,
              mileage: canonicalOrder.mileage,
              operatingHours: canonicalOrder.operatingHours,
              insuranceCompanyNit: canonicalOrder.insuranceCompanyNit,
              isBilled: canonicalOrder.isBilled,
              isVoided: canonicalOrder.isVoided,
              promisedDeliveryAt: canonicalOrder.promisedDeliveryAt,
              enteredAt: canonicalOrder.enteredAt,
            });

            if (!woResult.ok) {
              throw new Error(woResult.error.message);
            }

            // 4. Actualizar odómetro del vehículo si viene informado en la OT
            if (canonicalOrder.mileage !== null) {
              const mileageVo = Mileage.create(canonicalOrder.mileage);
              if (mileageVo.ok) {
                vehicle.recordUsage({
                  mileage: mileageVo.value,
                  source: 'erp_ot',
                  readingDate: new Date(canonicalOrder.enteredAt),
                });
                await vehicleRepo.save(vehicle);
              }
            }

            // 5. Ejecutar Motor de Proyección de Próximo Ingreso (D-35)
            const allVehicleOrders = await woRepo.findByVehicleId(vehicle.id);
            const visits = allVehicleOrders.map((o) => ({
              enteredAt: o.enteredAt,
              mileage: o.mileage,
              operatingHours: o.operatingHours,
              orderType: o.orderType,
            }));

            const projectionRepo = new BunSqlMaintenanceProjectionRepository(tx);
            const projectUseCase = new ProjectVehicleNextVisitUseCase(projectionRepo);

            const projectionResult = await projectUseCase.execute({
              tenantId: evt.tenant_id,
              vehicleId: vehicle.id,
              vehicleType: vehicle.vehicleType,
              currentMileage: vehicle.currentMileage?.value,
              currentOperatingHours: vehicle.currentOperatingHours?.value,
              visits,
              lastVisitDate: new Date(canonicalOrder.enteredAt),
            });

            // 6. Ejecutar Motor de Oportunidades Predictivas (D-37, D-38, D-39)
            if (projectionResult.ok) {
              const oppRepo = new BunSqlOpportunityRepository(tx);
              const detectOppUseCase = new DetectOpportunitiesUseCase(oppRepo);

              await detectOppUseCase.execute({
                tenantId: evt.tenant_id,
                vehicle: {
                  id: vehicle.id,
                  tenantId: evt.tenant_id,
                  vin: vehicle.vin?.value,
                  plate: vehicle.plate?.value,
                  make: vehicle.make,
                  model: vehicle.model,
                  modelYear: vehicle.modelYear,
                  vehicleType: vehicle.vehicleType,
                  currentMileage: vehicle.currentMileage?.value,
                  currentOperatingHours: vehicle.currentOperatingHours?.value,
                  warrantyEndDate: vehicle.warrantyEndDate,
                  rtmDueDate: vehicle.rtmDueDate,
                  primaryOwnerPartyId: partyId,
                  isCompanyOwner: party?.isCompany ?? false,
                },
                projection: {
                  projectedDate: projectionResult.value.projectedDate,
                  projectedMileage: projectionResult.value.projectedMileage,
                  projectionMethod: projectionResult.value.projectionMethod,
                  confidenceLevel: projectionResult.value.confidenceLevel,
                },
                lastVisitDate: new Date(canonicalOrder.enteredAt),
              });
            }

            processed++;
            await tx`
              UPDATE inbox_events
              SET status = 'processed', processed_at = NOW()
              WHERE id = ${evt.id}::uuid
            `;
          } else {
            // Otras tablas (bodegas, etc.)
            skipped++;
            await tx`
              UPDATE inbox_events
              SET status = 'processed', error_message = 'Tabla sin procesador activo en este hito', processed_at = NOW()
              WHERE id = ${evt.id}::uuid
            `;
          }
        });
      } catch (err: unknown) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        await withTenant(this.sql, { tenantId: evt.tenant_id }, async (tx) => {
          await tx`
            UPDATE inbox_events
            SET status = 'failed', error_message = ${errorMessage}
            WHERE id = ${evt.id}::uuid
          `;

          await tx`
            INSERT INTO ingest_errors (
              tenant_id,
              inbox_event_id,
              source_table,
              error_type,
              error_detail
            ) VALUES (
              ${evt.tenant_id}::uuid,
              ${evt.id}::uuid,
              ${evt.source_table},
              'translation_error',
              ${errorMessage}
            )
          `;
        });
      }
    }

    return { processed, failed, skipped };
  }
}
