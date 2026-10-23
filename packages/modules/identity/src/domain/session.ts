export interface SessionData {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly email: string;
  readonly fullName: string;
  readonly role: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SessionStore {
  createSession(
    data: Omit<SessionData, 'sessionId' | 'createdAt' | 'expiresAt'>,
    ttlSeconds?: number,
  ): Promise<SessionData>;
  getSession(sessionId: string): Promise<SessionData | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}
