import { describe, expect, it } from 'bun:test';
import { ErpTranslators } from './translators';
import type { ErpWebhookEvent } from './contracts';

describe('ERP Anti-Corruption Layer (ACL)', () => {
  it('translates dbo.terceros applying data minimization (D-48)', () => {
    const rawEvent: ErpWebhookEvent = {
      event_id: 'e1',
      source_table: 'dbo.terceros',
      operation: 'INSERT',
      captured_at: '2026-10-12T14:00:00Z',
      payload: {
        after: {
          nit: '900123456',
          nombres: 'Transportes del Norte SAS',
          mail: 'contacto@transnorte.co',
          celular: '3001234567',
          ciudad: 'Bogotá',
          tipo_identificacion: 'NIT',
          // Campos sensibles que DEBEN ser ignorados
          sexo: 'M',
          estado_civil: 'S',
          estrato: '4',
        },
      },
    };

    const canonical = ErpTranslators.translateTerceros(rawEvent);
    expect(canonical).not.toBeNull();
    expect(canonical?.documentNumber).toBe('900123456');
    expect(canonical?.fullName).toBe('Transportes del Norte SAS');
    expect(canonical?.isCompany).toBe(true);
    // Verificamos que no expone campos demográficos
    expect((canonical as unknown as Record<string, unknown>)['sexo']).toBeUndefined();
    expect((canonical as unknown as Record<string, unknown>)['estrato']).toBeUndefined();
  });

  it('translates dbo.referencias_imp capturing plate, chasis, and RTM date (D-47)', () => {
    const rawEvent: ErpWebhookEvent = {
      event_id: 'e2',
      source_table: 'dbo.referencias_imp',
      operation: 'INSERT',
      captured_at: '2026-10-12T14:05:00Z',
      payload: {
        after: {
          codigo: 'VH001',
          placa: 'WXY987',
          chasis: '9BWZZZ377VT004321',
          modelo_taller: 'DUSTER',
          modelo_ano: 2024,
          kilometraje: 15400,
          fecha_tecnico_mecanica: '2027-05-15T00:00:00Z',
          nit_comprador: '900123456',
        },
      },
    };

    const vehicle = ErpTranslators.translateReferenciasImp(rawEvent);
    expect(vehicle).not.toBeNull();
    expect(vehicle?.plate).toBe('WXY987');
    expect(vehicle?.vin).toBe('9BWZZZ377VT004321');
    expect(vehicle?.technicalInspectionDate).toBe('2027-05-15T00:00:00Z');
    expect(vehicle?.mileage).toBe(15400);
  });

  it('translates dbo.tall_encabeza_orden classifying collision vs maintenance (D-46)', () => {
    const maintenanceEvent: ErpWebhookEvent = {
      event_id: 'e3',
      source_table: 'dbo.tall_encabeza_orden',
      operation: 'INSERT',
      captured_at: '2026-10-12T14:10:00Z',
      payload: {
        after: {
          bodega: 1,
          numero: 10450,
          serie: 'VH001',
          nit: '900123456',
          kilometraje: 20100,
          tipo: 'MTO 20K',
          estado: 'ABIERTA',
        },
      },
    };

    const canonicalMto = ErpTranslators.translateWorkOrder(maintenanceEvent);
    expect(canonicalMto).not.toBeNull();
    expect(canonicalMto?.externalId).toBe('1_10450');
    expect(canonicalMto?.orderType).toBe('maintenance');

    const collisionEvent: ErpWebhookEvent = {
      event_id: 'e4',
      source_table: 'dbo.tall_encabeza_orden',
      operation: 'INSERT',
      captured_at: '2026-10-12T14:15:00Z',
      payload: {
        after: {
          bodega: 1,
          numero: 10451,
          serie: 'VH001',
          nit: '900123456',
          kilometraje: 20100,
          tipo: 'REPARACION',
          aseguradora: '860002184',
          siniestro: 'SIN-8899',
        },
      },
    };

    const canonicalCol = ErpTranslators.translateWorkOrder(collisionEvent);
    expect(canonicalCol?.orderType).toBe('collision');
  });
});
