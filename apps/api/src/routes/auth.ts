import { SQL } from 'bun';
import {
  AuthenticateUserUseCase,
  BunArgon2PasswordHasher,
  BunSqlUserRepository,
  RedisSessionStore,
  type SessionData,
} from '@mia-crm/module-identity';
import { withTenant } from '@mia-crm/db';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export function createAuthRouter(options?: {
  sql?: SQL;
  sessionStore?: RedisSessionStore;
}) {
  const router = new Hono();
  const sql =
    options?.sql ??
    new SQL(
      process.env.APP_DATABASE_URL ||
        'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev',
    );
  const sessionStore = options?.sessionStore ?? new RedisSessionStore();
  const hasher = new BunArgon2PasswordHasher();

  // POST /login
  router.post('/login', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; tenantId?: string }>();

    if (!body.email || !body.password || !body.tenantId) {
      return c.json(
        { error: 'BAD_REQUEST', message: 'email, password y tenantId son obligatorios.' },
        400,
      );
    }

    const authResult = await withTenant(sql, { tenantId: body.tenantId }, async (tx) => {
      const userRepo = new BunSqlUserRepository(tx);
      const useCase = new AuthenticateUserUseCase(userRepo, hasher);
      return await useCase.execute({
        email: body.email,
        password: body.password,
      });
    });

    if (!authResult.ok) {
      return c.json({ error: authResult.error.code, message: authResult.error.message }, 401);
    }

    const { user, requiresMfa } = authResult.value;

    // Crear sesión opaca en Redis (D-40)
    const session = await sessionStore.createSession({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      email: user.email.value,
      fullName: user.fullName,
      role: user.role.value,
    });

    // Fijar cookie HttpOnly segura
    setCookie(c, 'mia_session', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 86400,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email.value,
        fullName: user.fullName,
        role: user.role.value,
        tenantId: user.tenantId,
      },
      requiresMfa,
    });
  });

  // POST /logout
  router.post('/logout', async (c) => {
    const sessionId = getCookie(c, 'mia_session');
    if (sessionId) {
      await sessionStore.revokeSession(sessionId);
      deleteCookie(c, 'mia_session', { path: '/' });
    }
    return c.json({ message: 'Sesión finalizada exitosamente.' });
  });

  // GET /me
  router.get('/me', async (c) => {
    const sessionId = getCookie(c, 'mia_session');
    if (!sessionId) {
      return c.json({ error: 'UNAUTHORIZED', message: 'No hay sesión activa.' }, 401);
    }

    const session = await sessionStore.getSession(sessionId);
    if (!session) {
      deleteCookie(c, 'mia_session', { path: '/' });
      return c.json(
        { error: 'SESSION_EXPIRED', message: 'La sesión ha expirado o fue revocada.' },
        401,
      );
    }

    return c.json({ session });
  });

  return router;
}
