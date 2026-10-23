import { AggregateRoot, type Result } from '@mia-crm/kernel';
import type { Email, UserRole } from './value-objects';

export interface UserProps {
  id: string;
  tenantId: string;
  branchId: string | null;
  email: Email;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  createdAt: Date;
}

export class User extends AggregateRoot<string> {
  private props: UserProps;

  constructor(props: UserProps) {
    super(props.id);
    this.props = props;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get branchId(): string | null {
    return this.props.branchId;
  }
  get email(): Email {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get mfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }
  get mfaSecret(): string | null {
    return this.props.mfaSecret;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  enableMfa(secret: string): void {
    this.props.mfaEnabled = true;
    this.props.mfaSecret = secret;
  }

  disableMfa(): void {
    this.props.mfaEnabled = false;
    this.props.mfaSecret = null;
  }

  deactivate(): void {
    this.props.isActive = false;
  }
}
