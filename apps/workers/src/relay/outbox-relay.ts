import type { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';

export interface OutboxRelayResult {
  published: number;
  failed: number;
}

export interface MessagePublisher {
  publish(event: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    tenantId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export class OutboxRelay {
  constructor(
    private readonly sql: SQL,
    private readonly publisher?: MessagePublisher,
  ) {}

  async relayPendingBatch(batchSize = 50): Promise<OutboxRelayResult> {
    const pendingEvents = await this.sql<
      {
        id: string;
        tenant_id: string;
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        payload: Record<string, unknown>;
      }[]
    >`
      SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, payload
      FROM get_pending_outbox_events(${batchSize})
    `;

    let published = 0;
    let failed = 0;

    for (const evt of pendingEvents) {
      try {
        const rawPayload = evt.payload;
        const parsedPayload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

        if (this.publisher) {
          await this.publisher.publish({
            eventType: evt.event_type,
            aggregateType: evt.aggregate_type,
            aggregateId: evt.aggregate_id,
            tenantId: evt.tenant_id,
            payload: parsedPayload,
          });
        }

        await withTenant(this.sql, { tenantId: evt.tenant_id }, async (tx) => {
          await tx`
            UPDATE outbox_events
            SET status = 'published', published_at = NOW()
            WHERE id = ${evt.id}::uuid
          `;
        });

        published++;
      } catch (err: unknown) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        await withTenant(this.sql, { tenantId: evt.tenant_id }, async (tx) => {
          await tx`
            UPDATE outbox_events
            SET retry_count = retry_count + 1, error_message = ${errorMessage}
            WHERE id = ${evt.id}::uuid
          `;
        });
      }
    }

    return { published, failed };
  }
}
