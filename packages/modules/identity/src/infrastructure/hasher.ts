import type { PasswordHasher } from '../domain/ports';

export class BunArgon2PasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return await Bun.password.hash(plain, {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
    });
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return await Bun.password.verify(plain, hash);
  }
}
