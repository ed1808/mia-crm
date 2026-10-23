import { createClient, type RedisClientType } from 'redis';
import type { SessionData, SessionStore } from '../domain/session';

export class RedisSessionStore implements SessionStore {
  private client: RedisClientType;
  private isConnected = false;

  constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.client = createClient({ url: redisUrl });
  }

  private async ensureConnected() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  async createSession(
    data: Omit<SessionData, 'sessionId' | 'createdAt' | 'expiresAt'>,
    ttlSeconds = 86400, // 24 horas por defecto
  ): Promise<SessionData> {
    await this.ensureConnected();

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: SessionData = {
      ...data,
      sessionId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const sessionKey = `mia:session:${sessionId}`;
    const userSessionsKey = `mia:user_sessions:${data.userId}`;

    await this.client.set(sessionKey, JSON.stringify(session), { EX: ttlSeconds });
    await this.client.sAdd(userSessionsKey, sessionId);
    await this.client.expire(userSessionsKey, ttlSeconds);

    return session;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    await this.ensureConnected();

    const raw = await this.client.get(`mia:session:${sessionId}`);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.ensureConnected();

    const session = await this.getSession(sessionId);
    if (session) {
      await this.client.del(`mia:session:${sessionId}`);
      await this.client.sRem(`mia:user_sessions:${session.userId}`, sessionId);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.ensureConnected();

    const userSessionsKey = `mia:user_sessions:${userId}`;
    const sessionIds = await this.client.sMembers(userSessionsKey);

    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => `mia:session:${id}`);
      await this.client.del(keys);
    }

    await this.client.del(userSessionsKey);
  }

  async close(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}
