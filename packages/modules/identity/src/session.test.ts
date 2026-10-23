import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { RedisSessionStore } from './infrastructure/redis-session-store';

describe('RedisSessionStore (D-40 Server-side Opaque Sessions)', () => {
  let store: RedisSessionStore;
  const userId = '00000000-0000-0000-0000-000000000002';
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeAll(() => {
    store = new RedisSessionStore();
  });

  afterAll(async () => {
    await store.close();
  });

  it('creates, retrieves, and revokes a server-side session', async () => {
    const session = await store.createSession({
      userId,
      tenantId,
      branchId: null,
      email: 'asesor@mia.co',
      fullName: 'Andrés López',
      role: 'sales_advisor',
    });

    expect(session.sessionId).toBeString();
    expect(session.userId).toBe(userId);

    // Recuperar sesión existente
    const fetched = await store.getSession(session.sessionId);
    expect(fetched).not.toBeNull();
    expect(fetched?.email).toBe('asesor@mia.co');

    // Revocar sesión única
    await store.revokeSession(session.sessionId);
    const afterRevoke = await store.getSession(session.sessionId);
    expect(afterRevoke).toBeNull();
  });

  it('revokes all sessions for a user instantly', async () => {
    const s1 = await store.createSession({
      userId,
      tenantId,
      branchId: null,
      email: 'asesor@mia.co',
      fullName: 'Andrés López',
      role: 'sales_advisor',
    });
    const s2 = await store.createSession({
      userId,
      tenantId,
      branchId: null,
      email: 'asesor@mia.co',
      fullName: 'Andrés López',
      role: 'sales_advisor',
    });

    await store.revokeAllUserSessions(userId);

    expect(await store.getSession(s1.sessionId)).toBeNull();
    expect(await store.getSession(s2.sessionId)).toBeNull();
  });
});
