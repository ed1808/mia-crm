import type { SQL } from 'bun';
import { Party } from '../domain/party';
import type { PartyRepository } from '../domain/party-repository';
import {
  DocumentNumber,
  type DocumentType,
  type PartyType,
  type ContactChannel,
} from '../domain/value-objects';

export class BunSqlPartyRepository implements PartyRepository {
  constructor(private readonly sql: SQL) {}

  private computeHash(idType: string, idNumber: string): string {
    const raw = `${idType.toUpperCase().trim()}:${idNumber.toUpperCase().trim()}`;
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(raw);
    return hasher.digest('hex');
  }

  async isSuppressed(idType: string, idNumber: string): Promise<boolean> {
    const hash = this.computeHash(idType, idNumber);
    const rows = await this.sql<{ id: string }[]>`
      SELECT id FROM suppression_records WHERE identifier_hash = ${hash} LIMIT 1
    `;
    return rows.length > 0;
  }

  async suppress(idType: string, idNumber: string, reason: string): Promise<void> {
    const hash = this.computeHash(idType, idNumber);

    // 1. Registrar hash de supresión
    await this.sql`
      INSERT INTO suppression_records (tenant_id, identifier_hash, reason)
      VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::UUID,
        ${hash},
        ${reason}
      )
      ON CONFLICT (tenant_id, identifier_hash) DO NOTHING
    `;

    // 2. Eliminar de raíz al tercero y todos sus datos personales (ON DELETE CASCADE)
    await this.sql`
      DELETE FROM parties
      WHERE id IN (
        SELECT party_id FROM party_identifiers
        WHERE id_type = ${idType.toUpperCase().trim()}
          AND id_number = ${idNumber.toUpperCase().trim()}
      )
    `;
  }

  async findById(id: string): Promise<Party | null> {
    const partyRows = await this.sql<
      {
        id: string;
        tenant_id: string;
        party_type: PartyType;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT id, tenant_id, party_type, created_at, updated_at
      FROM parties WHERE id = ${id}::uuid
    `;

    const row = partyRows[0];
    if (!row) return null;

    let firstName: string | undefined;
    let lastName: string | undefined;
    let legalName: string | undefined;
    let tradeName: string | undefined;

    if (row.party_type === 'person') {
      const personRows = await this.sql<{ first_name: string; last_name: string | null }[]>`
        SELECT first_name, last_name FROM persons WHERE party_id = ${id}::uuid
      `;
      const p = personRows[0];
      if (p) {
        firstName = p.first_name;
        lastName = p.last_name ?? undefined;
      }
    } else {
      const compRows = await this.sql<{ legal_name: string; trade_name: string | null }[]>`
        SELECT legal_name, trade_name FROM companies WHERE party_id = ${id}::uuid
      `;
      const c = compRows[0];
      if (c) {
        legalName = c.legal_name;
        tradeName = c.trade_name ?? undefined;
      }
    }

    const idRows = await this.sql<
      {
        id_type: string;
        id_number: string;
        is_primary: boolean;
      }[]
    >`
      SELECT id_type, id_number, is_primary FROM party_identifiers WHERE party_id = ${id}::uuid
    `;

    const identifiers = idRows
      .map((r) => {
        const docRes = DocumentNumber.create(r.id_number);
        if (!docRes.ok) return null;
        return {
          idType: r.id_type as DocumentType,
          idNumber: docRes.value,
          isPrimary: r.is_primary,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    const cpRows = await this.sql<
      {
        channel: string;
        value: string;
        is_primary: boolean;
        is_valid: boolean;
      }[]
    >`
      SELECT channel, value, is_primary, is_valid FROM party_contact_points WHERE party_id = ${id}::uuid
    `;

    const contactPoints = cpRows.map((r) => ({
      channel: r.channel as ContactChannel,
      value: r.value,
      isPrimary: r.is_primary,
      isValid: r.is_valid,
    }));

    return Party.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      partyType: row.party_type,
      firstName,
      lastName,
      legalName,
      tradeName,
      identifiers,
      contactPoints,
      consents: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findByIdentifier(idType: string, idNumber: string): Promise<Party | null> {
    const cleanedNumber = idNumber
      .replace(/[.\-\s]/g, '')
      .trim()
      .toUpperCase();
    const rows = await this.sql<{ party_id: string }[]>`
      SELECT party_id FROM party_identifiers
      WHERE id_type = ${idType.toUpperCase().trim()}
        AND id_number = ${cleanedNumber}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    return await this.findById(row.party_id);
  }

  async save(party: Party): Promise<void> {
    // 1. Guardar o actualizar registro principal en parties
    await this.sql`
      INSERT INTO parties (id, tenant_id, party_type, updated_at)
      VALUES (
        ${party.id}::uuid,
        ${party.tenantId}::uuid,
        ${party.partyType},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        party_type = EXCLUDED.party_type,
        updated_at = NOW()
    `;

    // 2. Guardar persona o empresa
    if (party.partyType === 'person') {
      await this.sql`
        INSERT INTO persons (party_id, tenant_id, first_name, last_name)
        VALUES (
          ${party.id}::uuid,
          ${party.tenantId}::uuid,
          ${party.firstName ?? 'Persona'},
          ${party.lastName ?? null}
        )
        ON CONFLICT (party_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name
      `;
    } else {
      await this.sql`
        INSERT INTO companies (party_id, tenant_id, legal_name, trade_name)
        VALUES (
          ${party.id}::uuid,
          ${party.tenantId}::uuid,
          ${party.legalName ?? 'Empresa'},
          ${party.tradeName ?? null}
        )
        ON CONFLICT (party_id) DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          trade_name = EXCLUDED.trade_name
      `;
    }

    // 3. Guardar identificadores
    for (const ident of party.identifiers) {
      await this.sql`
        INSERT INTO party_identifiers (tenant_id, party_id, id_type, id_number, is_primary)
        VALUES (
          ${party.tenantId}::uuid,
          ${party.id}::uuid,
          ${ident.idType},
          ${ident.idNumber.value},
          ${ident.isPrimary}
        )
        ON CONFLICT (tenant_id, id_type, id_number) DO UPDATE SET
          is_primary = EXCLUDED.is_primary
      `;
    }

    // 4. Guardar puntos de contacto
    for (const cp of party.contactPoints) {
      await this.sql`
        INSERT INTO party_contact_points (tenant_id, party_id, channel, value, is_primary, is_valid)
        VALUES (
          ${party.tenantId}::uuid,
          ${party.id}::uuid,
          ${cp.channel},
          ${cp.value},
          ${cp.isPrimary},
          ${cp.isValid}
        )
      `;
    }

    // 5. Persistir eventos de dominio pendientes al Outbox (D-23)
    for (const event of party.domainEvents) {
      await this.sql`
        INSERT INTO outbox_events (
          tenant_id,
          event_type,
          aggregate_type,
          aggregate_id,
          payload
        ) VALUES (
          ${party.tenantId}::uuid,
          ${event.eventType},
          'Party',
          ${party.id},
          ${JSON.stringify(event.payload ?? {})}::jsonb
        )
      `;
    }

    party.clearDomainEvents();
  }
}
