import type { SQL } from 'bun';
import type { ContactPressureRepository } from '../domain/contact-pressure-repository';

export class BunSqlContactPressureRepository implements ContactPressureRepository {
  constructor(private readonly sql: SQL) {}

  async recordContact(
    partyId: string,
    channel: string,
    contactedAt: Date,
    cooldownUntil: Date,
  ): Promise<void> {
    await this.sql`
      INSERT INTO contact_pressure (
        tenant_id, party_id, channel, last_contacted_at, cooldown_until
      ) VALUES (
        NULLIF(current_setting('app.tenant_id', true), '')::UUID,
        ${partyId}::uuid,
        ${channel},
        ${contactedAt.toISOString()}::timestamptz,
        ${cooldownUntil.toISOString()}::timestamptz
      )
      ON CONFLICT (tenant_id, party_id, channel) DO UPDATE SET
        last_contacted_at = EXCLUDED.last_contacted_at,
        cooldown_until = EXCLUDED.cooldown_until
    `;
  }

  async isUnderCooldown(partyId: string, channel: string, now: Date): Promise<boolean> {
    const rows = await this.sql<{ id: string }[]>`
      SELECT id
      FROM contact_pressure
      WHERE party_id = ${partyId}::uuid
        AND channel = ${channel}
        AND cooldown_until > ${now.toISOString()}::timestamptz
      LIMIT 1
    `;

    return rows.length > 0;
  }
}
