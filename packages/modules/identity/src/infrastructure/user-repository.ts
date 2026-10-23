import type { SQL } from 'bun';
import { User } from '../domain/entities';
import type { UserRepository } from '../domain/ports';
import { Email, UserRole } from '../domain/value-objects';

export class BunSqlUserRepository implements UserRepository {
  constructor(private readonly txOrSql: SQL) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.txOrSql<
      {
        id: string;
        tenant_id: string;
        branch_id: string | null;
        email: string;
        password_hash: string;
        full_name: string;
        role: string;
        is_active: boolean;
        mfa_enabled: boolean;
        mfa_secret: string | null;
        created_at: Date;
      }[]
    >`
      SELECT id, tenant_id, branch_id, email, password_hash, full_name, role, is_active, mfa_enabled, mfa_secret, created_at
      FROM app_users
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!rows[0]) return null;
    return this.mapToEntity(rows[0]);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.txOrSql<
      {
        id: string;
        tenant_id: string;
        branch_id: string | null;
        email: string;
        password_hash: string;
        full_name: string;
        role: string;
        is_active: boolean;
        mfa_enabled: boolean;
        mfa_secret: string | null;
        created_at: Date;
      }[]
    >`
      SELECT id, tenant_id, branch_id, email, password_hash, full_name, role, is_active, mfa_enabled, mfa_secret, created_at
      FROM app_users
      WHERE email = ${email.value}
      LIMIT 1
    `;

    if (!rows[0]) return null;
    return this.mapToEntity(rows[0]);
  }

  async save(user: User): Promise<void> {
    await this.txOrSql`
      INSERT INTO app_users (
        id, tenant_id, branch_id, email, password_hash, full_name, role, is_active, mfa_enabled, mfa_secret, created_at
      ) VALUES (
        ${user.id}::uuid,
        ${user.tenantId}::uuid,
        ${user.branchId ? `${user.branchId}::uuid` : null},
        ${user.email.value},
        ${user.passwordHash},
        ${user.fullName},
        ${user.role.value},
        ${user.isActive},
        ${user.mfaEnabled},
        ${user.mfaSecret},
        ${user.createdAt.toISOString()}
      )
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        mfa_enabled = EXCLUDED.mfa_enabled,
        mfa_secret = EXCLUDED.mfa_secret
    `;
  }

  private mapToEntity(row: {
    id: string;
    tenant_id: string;
    branch_id: string | null;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    is_active: boolean;
    mfa_enabled: boolean;
    mfa_secret: string | null;
    created_at: Date;
  }): User {
    const email = Email.create(row.email);
    const role = UserRole.create(row.role);

    if (!email.ok || !role.ok) {
      throw new Error(`Datos corruptos de usuario en la base de datos para ID: ${row.id}`);
    }

    return new User({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      email: email.value,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: role.value,
      isActive: row.is_active,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      createdAt: new Date(row.created_at),
    });
  }
}
