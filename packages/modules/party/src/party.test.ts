import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  DocumentNumber,
  Email,
  PhoneNumber,
  Party,
  UpsertPartyFromErpUseCase,
  SuppressPartyUseCase,
  BunSqlPartyRepository,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('Party Module: Clean Architecture, SOLID & Ley 1581 Compliance', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug)
      VALUES ('Concesionario Party Test', 'party-test')
      RETURNING id
    `;
    tenantId = t!.id;
  });

  afterAll(async () => {
    if (adminSql && tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
  });

  it('validates and normalizes Value Objects against Primitive Obsession', () => {
    const validNit = DocumentNumber.create(' 900.123.456-1 ');
    expect(validNit.ok).toBe(true);
    if (validNit.ok) {
      expect(validNit.value.value).toBe('9001234561');
    }

    const invalidEmail = Email.create('correo_invalido');
    expect(invalidEmail.ok).toBe(false);

    const validPhone = PhoneNumber.create('+57 (310) 123-4567');
    expect(validPhone.ok).toBe(true);
    if (validPhone.ok) {
      expect(validPhone.value.value).toBe('573101234567');
    }
  });

  it('creates and updates Party via UpsertPartyFromErpUseCase and emits Outbox event', async () => {
    const result = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const useCase = new UpsertPartyFromErpUseCase(repo);

      return await useCase.execute({
        tenantId,
        documentType: 'CC',
        documentNumber: '1020304050',
        fullName: 'Mateo Gómez Aristizábal',
        email: 'mateo.gomez@ejemplo.com',
        phone: '3129876543',
        isCompany: false,
      });
    });

    expect(result.ok).toBe(true);
    const partyId = result.ok ? result.value.partyId : '';
    expect(partyId).toBeDefined();

    // Verificar en BD y verificar que el Outbox contiene el evento
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const party = await repo.findById(partyId);

      expect(party).not.toBeNull();
      expect(party?.fullName).toBe('Mateo Gómez Aristizábal');
      expect(party?.primaryEmail).toBe('mateo.gomez@ejemplo.com');
      expect(party?.primaryPhone).toBe('3129876543');

      // Verificar Transactional Outbox
      const outboxRows = await tx<{ event_type: string; payload: any }[]>`
        SELECT event_type, payload FROM outbox_events WHERE aggregate_id = ${partyId}
      `;
      expect(outboxRows.length).toBeGreaterThan(0);
      expect(outboxRows[0]?.event_type).toBe('PartyUpserted');
      const rawPayload = outboxRows[0]?.payload;
      const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      expect(payload.documentNumber).toBe('1020304050');
    });
  });

  it('enforces Ley 1581 Habeas Data suppression (D-31, D-32) and blocks future re-ingestion', async () => {
    // 1. Crear un titular a ser suprimido
    let targetPartyId = '';
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const useCase = new UpsertPartyFromErpUseCase(repo);

      const res = await useCase.execute({
        tenantId,
        documentType: 'CC',
        documentNumber: '888777666',
        fullName: 'Laura Restrepo',
        email: 'laura@privacidad.com',
        phone: '3001112233',
        isCompany: false,
      });
      if (res.ok) targetPartyId = res.value.partyId;
    });

    expect(targetPartyId).not.toBe('');

    // 2. Ejecutar supresión definitiva (Habeas Data)
    const suppressRes = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const useCase = new SuppressPartyUseCase(repo);
      return await useCase.execute({
        partyId: targetPartyId,
        reason: 'Solicitud formal del titular (Ley 1581 / Habeas Data)',
      });
    });
    expect(suppressRes.ok).toBe(true);

    // 3. Verificar que el titular ya no existe en parties
    await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const party = await repo.findById(targetPartyId);
      expect(party).toBeNull();
    });

    // 4. Intentar re-ingestar desde el ERP: DEBE SER RECHAZADO con PARTY_SUPPRESSED
    const reingestRes = await withTenant(appSql, { tenantId }, async (tx) => {
      const repo = new BunSqlPartyRepository(tx);
      const useCase = new UpsertPartyFromErpUseCase(repo);
      return await useCase.execute({
        tenantId,
        documentType: 'CC',
        documentNumber: '888777666',
        fullName: 'Laura Restrepo',
        email: 'laura@privacidad.com',
        phone: '3001112233',
        isCompany: false,
      });
    });

    expect(reingestRes.ok).toBe(false);
    if (!reingestRes.ok) {
      expect(reingestRes.error.code).toBe('PARTY_SUPPRESSED');
    }
  });
});
