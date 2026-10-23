import { describe, expect, it } from 'bun:test';
import { AuthenticateUserUseCase } from './application/authenticate-user';
import { RegisterUserUseCase } from './application/register-user';
import type { User } from './domain/entities';
import type { PasswordHasher, UserRepository } from './domain/ports';
import type { Email } from './domain/value-objects';

class InMemoryUserRepo implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email.equals(email)) return u;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}

class FakeHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('Identity Module: Use Cases (Clean Architecture)', () => {
  const repo = new InMemoryUserRepo();
  const hasher = new FakeHasher();
  const registerUseCase = new RegisterUserUseCase(repo, hasher);
  const authUseCase = new AuthenticateUserUseCase(repo, hasher);

  const tenantId = '00000000-0000-0000-0000-000000000001';

  it('rejects passwords shorter than 12 characters (NIST 800-63B)', async () => {
    const res = await registerUseCase.execute({
      tenantId,
      email: 'asesor@mia.co',
      password: 'short',
      fullName: 'Juan Pérez',
      role: 'sales_advisor',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('WEAK_PASSWORD');
    }
  });

  it('registers user and authenticates successfully', async () => {
    const regRes = await registerUseCase.execute({
      tenantId,
      email: 'gerente@mia.co',
      password: 'SuperSecurePassword2026!',
      fullName: 'Laura Gómez',
      role: 'sales_manager',
    });

    expect(regRes.ok).toBe(true);

    const authRes = await authUseCase.execute({
      email: 'gerente@mia.co',
      password: 'SuperSecurePassword2026!',
    });

    expect(authRes.ok).toBe(true);
    if (authRes.ok) {
      expect(authRes.value.user.fullName).toBe('Laura Gómez');
      // Roles gerenciales deben exigir MFA (D-40)
      expect(authRes.value.requiresMfa).toBe(true);
    }
  });
});
