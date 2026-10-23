import { DomainError, Result } from '@mia-crm/kernel';
import { User } from '../domain/entities';
import type { PasswordHasher, UserRepository } from '../domain/ports';
import { Email, UserRole } from '../domain/value-objects';

export interface RegisterUserDto {
  tenantId: string;
  branchId?: string | null;
  email: string;
  password: string;
  fullName: string;
  role: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(dto: RegisterUserDto): Promise<Result<User>> {
    // 1. Validar Email
    const emailResult = Email.create(dto.email);
    if (!emailResult.ok) {
      return Result.fail(emailResult.error);
    }

    // 2. Validar Rol
    const roleResult = UserRole.create(dto.role);
    if (!roleResult.ok) {
      return Result.fail(roleResult.error);
    }

    // 3. Validar Contraseña (mínimo 12 caracteres, NIST 800-63B - Decisión D-40)
    if (dto.password.length < 12) {
      return Result.fail(
        new DomainError(
          'WEAK_PASSWORD',
          'La contraseña debe tener al menos 12 caracteres de acuerdo con la política NIST 800-63B.',
        ),
      );
    }

    // 4. Verificar que no exista usuario con este correo en el tenant
    const existing = await this.userRepo.findByEmail(emailResult.value);
    if (existing) {
      return Result.fail(
        new DomainError(
          'USER_ALREADY_EXISTS',
          `Ya existe un usuario registrado con el correo ${dto.email}.`,
        ),
      );
    }

    // 5. Hash con argon2id (Bun.password)
    const passwordHash = await this.hasher.hash(dto.password);

    // 6. Construir entidad
    const user = new User({
      id: crypto.randomUUID(),
      tenantId: dto.tenantId,
      branchId: dto.branchId ?? null,
      email: emailResult.value,
      passwordHash,
      fullName: dto.fullName.trim(),
      role: roleResult.value,
      isActive: true,
      mfaEnabled: false,
      mfaSecret: null,
      createdAt: new Date(),
    });

    // 7. Persistir
    await this.userRepo.save(user);

    return Result.ok(user);
  }
}
