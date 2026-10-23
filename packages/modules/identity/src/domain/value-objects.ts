import { DomainError, Result, type ValueObject } from '@mia-crm/kernel';

export class Email implements ValueObject<string> {
  private constructor(public readonly value: string) {}

  static create(raw: string): Result<Email> {
    const trimmed = raw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return Result.fail(
        new DomainError(
          'INVALID_EMAIL',
          `El correo electrónico "${raw}" no tiene un formato válido.`,
        ),
      );
    }
    return Result.ok(new Email(trimmed));
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

export type RoleType =
  | 'sales_advisor'
  | 'service_advisor'
  | 'sales_manager'
  | 'service_manager'
  | 'director'
  | 'admin';

export class UserRole implements ValueObject<RoleType> {
  private static readonly VALID_ROLES = new Set<RoleType>([
    'sales_advisor',
    'service_advisor',
    'sales_manager',
    'service_manager',
    'director',
    'admin',
  ]);

  private constructor(public readonly value: RoleType) {}

  static create(raw: string): Result<UserRole> {
    if (!UserRole.VALID_ROLES.has(raw as RoleType)) {
      return Result.fail(
        new DomainError('INVALID_ROLE', `El rol "${raw}" no es válido en el sistema automotriz.`),
      );
    }
    return Result.ok(new UserRole(raw as RoleType));
  }

  isManagerOrAbove(): boolean {
    return (
      this.value === 'sales_manager' ||
      this.value === 'service_manager' ||
      this.value === 'director' ||
      this.value === 'admin'
    );
  }

  equals(other: UserRole): boolean {
    return this.value === other.value;
  }
}
