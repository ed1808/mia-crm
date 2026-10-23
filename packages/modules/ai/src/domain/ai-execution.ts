// packages/modules/ai/src/domain/ai-execution.ts
import { AggregateRoot, Result } from '@mia-crm/kernel';
import { AutonomyLevel, type ToolExecutionStatus } from './autonomy';

export interface AiToolExecutionProps {
  id: string;
  tenantId: string;
  userId: string | null;
  role: string;
  taskType: string;
  toolName: string;
  autonomyLevel: AutonomyLevel;
  arguments: Record<string, any>;
  result?: any;
  status: ToolExecutionStatus;
  rejectionReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  durationMs: number;
  createdAt: Date;
}

export class AiToolExecution extends AggregateRoot<string> {
  private _props: AiToolExecutionProps;

  private constructor(props: AiToolExecutionProps) {
    super(props.id);
    this._props = { ...props };
  }

  public static create(
    props: Omit<AiToolExecutionProps, 'id' | 'createdAt'> & { id?: string; createdAt?: Date },
  ): AiToolExecution {
    return new AiToolExecution({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || new Date(),
    });
  }

  public get tenantId(): string {
    return this._props.tenantId;
  }

  public get userId(): string | null {
    return this._props.userId;
  }

  public get role(): string {
    return this._props.role;
  }

  public get taskType(): string {
    return this._props.taskType;
  }

  public get toolName(): string {
    return this._props.toolName;
  }

  public get autonomyLevel(): AutonomyLevel {
    return this._props.autonomyLevel;
  }

  public get arguments(): Record<string, any> {
    return this._props.arguments;
  }

  public get result(): any {
    return this._props.result;
  }

  public get status(): ToolExecutionStatus {
    return this._props.status;
  }

  public get durationMs(): number {
    return this._props.durationMs;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get approvedBy(): string | null | undefined {
    return this._props.approvedBy;
  }

  public get approvedAt(): Date | null | undefined {
    return this._props.approvedAt;
  }

  public approve(
    approvedByUserId?: string | null,
    result?: any,
    approvedAt: Date = new Date(),
  ): Result<void, string> {
    if (this._props.status !== 'pending_approval') {
      return Result.fail(`No se puede aprobar una ejecución en estado '${this._props.status}'`);
    }
    this._props.status = 'approved';
    this._props.approvedBy = approvedByUserId || null;
    this._props.approvedAt = approvedAt;
    this._props.result = result;
    return Result.ok(undefined);
  }

  public reject(rejectedByUserId: string | null | undefined, reason: string): Result<void, string> {
    if (this._props.status !== 'pending_approval') {
      return Result.fail(`No se puede rechazar una ejecución en estado '${this._props.status}'`);
    }
    this._props.status = 'rejected';
    this._props.rejectionReason = reason;
    this._props.approvedBy = rejectedByUserId || null;
    this._props.approvedAt = new Date();
    return Result.ok(undefined);
  }

  public toJSON(): AiToolExecutionProps {
    return { ...this._props };
  }
}
