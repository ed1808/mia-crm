import { DomainError, Result } from '@mia-crm/kernel';
import type { User } from '../domain/entities';
import type { PasswordHasher, UserRepository } from '../domain/ports';
import { Email } from '../domain/value-objects';

export interface AuthenticateUserDto {
  email: string;
  password: string;
}

export interface AuthSuccess {
  user: User;
  requiresMfa: boolean;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(dto: AuthenticateUserDto): Promise<Result<AuthSuccess>> {
    const emailResult = Email.create(dto.email);
    if (!emailResult.ok) {
      return Result.fail(new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas.'));
    }

    const user = await this.userRepo.findByEmail(emailResult.value);
    if (!user || !user.isActive) {
      return Result.fail(new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas.'));
    }

    const valid = await this.hasher.verify(dto.password, user.passwordHash);
    if (!valid) {
      return Result.fail(new DomainError('INVALID_CREDENTIALS', 'Credenciales inválidas.'));
    }

    // Regla D-40: MFA obligatorio para roles directivos/administrativos
    const requiresMfa = user.mfaEnabled || user.role.isManagerOrAbove();

    return Result.ok({
      user,
      requiresMfa,
    });
  }
}
