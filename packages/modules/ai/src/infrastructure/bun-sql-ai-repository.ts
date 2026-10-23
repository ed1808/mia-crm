// packages/modules/ai/src/infrastructure/bun-sql-ai-repository.ts
import type { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import { AiToolExecution } from '../domain/ai-execution';
import { AdvisorTask, InternalNote } from '../domain/collaboration';
import type {
  IAiExecutionRepository,
  IAdvisorTaskRepository,
  IInternalNoteRepository,
} from '../domain/ports';
import { AutonomyLevel, type ToolExecutionStatus } from '../domain/autonomy';

export class BunSqlAiRepository
  implements IAiExecutionRepository, IAdvisorTaskRepository, IInternalNoteRepository
{
  constructor(private readonly sql: SQL) {}

  // -------------------------------------------------------------
  // IAiExecutionRepository
  // -------------------------------------------------------------
  async saveExecution(execution: AiToolExecution): Promise<void> {
    const raw = execution.toJSON();
    await withTenant(this.sql, { tenantId: raw.tenantId }, async (tx) => {
      await tx`
        INSERT INTO ai_tool_executions (
          id, tenant_id, user_id, role, task_type, tool_name,
          autonomy_level, arguments, result, status, rejection_reason,
          approved_by, approved_at, duration_ms, created_at
        ) VALUES (
          ${raw.id}::uuid,
          ${raw.tenantId}::uuid,
          ${raw.userId ?? null}::uuid,
          ${raw.role},
          ${raw.taskType},
          ${raw.toolName},
          ${raw.autonomyLevel},
          ${JSON.stringify(raw.arguments)}::jsonb,
          ${raw.result ? JSON.stringify(raw.result) : null}::jsonb,
          ${raw.status},
          ${raw.rejectionReason ?? null},
          ${raw.approvedBy ?? null}::uuid,
          ${raw.approvedAt ? raw.approvedAt.toISOString() : null}::timestamptz,
          ${raw.durationMs},
          ${raw.createdAt.toISOString()}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          result = EXCLUDED.result,
          rejection_reason = EXCLUDED.rejection_reason,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          duration_ms = EXCLUDED.duration_ms
      `;
    });
  }

  async findById(tenantId: string, id: string): Promise<AiToolExecution | null> {
    const rows = await withTenant(this.sql, { tenantId }, async (tx) => {
      return await tx<
        {
          id: string;
          tenant_id: string;
          user_id: string | null;
          role: string;
          task_type: string;
          tool_name: string;
          autonomy_level: number;
          arguments: any;
          result: any;
          status: string;
          rejection_reason: string | null;
          approved_by: string | null;
          approved_at: Date | null;
          duration_ms: number;
          created_at: Date;
        }[]
      >`
        SELECT * FROM ai_tool_executions WHERE id = ${id}::uuid
      `;
    });

    const r = rows[0];
    if (!r) return null;

    return AiToolExecution.create({
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      role: r.role,
      taskType: r.task_type,
      toolName: r.tool_name,
      autonomyLevel: r.autonomy_level as AutonomyLevel,
      arguments: typeof r.arguments === 'string' ? JSON.parse(r.arguments) : r.arguments || {},
      result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
      status: r.status as ToolExecutionStatus,
      rejectionReason: r.rejection_reason,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at ? new Date(r.approved_at) : null,
      durationMs: r.duration_ms,
      createdAt: new Date(r.created_at),
    });
  }

  async listRecent(tenantId: string, limit = 50): Promise<AiToolExecution[]> {
    const rows = await withTenant(this.sql, { tenantId }, async (tx) => {
      return await tx<
        {
          id: string;
          tenant_id: string;
          user_id: string | null;
          role: string;
          task_type: string;
          tool_name: string;
          autonomy_level: number;
          arguments: any;
          result: any;
          status: string;
          rejection_reason: string | null;
          approved_by: string | null;
          approved_at: Date | null;
          duration_ms: number;
          created_at: Date;
        }[]
      >`
        SELECT * FROM ai_tool_executions
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    });

    return rows.map((r) =>
      AiToolExecution.create({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        role: r.role,
        taskType: r.task_type,
        toolName: r.tool_name,
        autonomyLevel: r.autonomy_level as AutonomyLevel,
        arguments: typeof r.arguments === 'string' ? JSON.parse(r.arguments) : r.arguments || {},
        result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
        status: r.status as ToolExecutionStatus,
        rejectionReason: r.rejection_reason,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at ? new Date(r.approved_at) : null,
        durationMs: r.duration_ms,
        createdAt: new Date(r.created_at),
      }),
    );
  }

  async listPendingApprovals(tenantId: string): Promise<AiToolExecution[]> {
    const rows = await withTenant(this.sql, { tenantId }, async (tx) => {
      return await tx<
        {
          id: string;
          tenant_id: string;
          user_id: string | null;
          role: string;
          task_type: string;
          tool_name: string;
          autonomy_level: number;
          arguments: any;
          result: any;
          status: string;
          rejection_reason: string | null;
          approved_by: string | null;
          approved_at: Date | null;
          duration_ms: number;
          created_at: Date;
        }[]
      >`
        SELECT * FROM ai_tool_executions
        WHERE status = 'pending_approval'
        ORDER BY created_at ASC
      `;
    });

    return rows.map((r) =>
      AiToolExecution.create({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        role: r.role,
        taskType: r.task_type,
        toolName: r.tool_name,
        autonomyLevel: r.autonomy_level as AutonomyLevel,
        arguments: typeof r.arguments === 'string' ? JSON.parse(r.arguments) : r.arguments || {},
        result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
        status: r.status as ToolExecutionStatus,
        rejectionReason: r.rejection_reason,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at ? new Date(r.approved_at) : null,
        durationMs: r.duration_ms,
        createdAt: new Date(r.created_at),
      }),
    );
  }

  // -------------------------------------------------------------
  // IAdvisorTaskRepository
  // -------------------------------------------------------------
  async saveTask(task: AdvisorTask): Promise<void> {
    const raw = task.toJSON();
    await withTenant(this.sql, { tenantId: raw.tenantId }, async (tx) => {
      await tx`
        INSERT INTO advisor_tasks (
          id, tenant_id, user_id, title, description,
          entity_type, entity_id, due_date, status, created_at, updated_at
        ) VALUES (
          ${raw.id}::uuid,
          ${raw.tenantId}::uuid,
          ${raw.userId ?? null}::uuid,
          ${raw.title},
          ${raw.description ?? null},
          ${raw.entityType ?? null},
          ${raw.entityId ?? null},
          ${raw.dueDate ? raw.dueDate.toISOString() : null}::timestamptz,
          ${raw.status},
          ${raw.createdAt.toISOString()}::timestamptz,
          ${raw.updatedAt.toISOString()}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          due_date = EXCLUDED.due_date,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `;
    });
  }

  async save(item: AiToolExecution | AdvisorTask): Promise<void> {
    if (item instanceof AiToolExecution) {
      return this.saveExecution(item);
    }
    return this.saveTask(item);
  }

  async listByUser(
    tenantId: string,
    userId: string | null,
    status?: string,
  ): Promise<AdvisorTask[]> {
    const rows = await withTenant(this.sql, { tenantId }, async (tx) => {
      return await tx<
        {
          id: string;
          tenant_id: string;
          user_id: string | null;
          title: string;
          description: string | null;
          entity_type: string | null;
          entity_id: string | null;
          due_date: Date | null;
          status: string;
          created_at: Date;
          updated_at: Date;
        }[]
      >`
        SELECT * FROM advisor_tasks
        WHERE (${userId ? `${userId}::uuid` : null}::uuid IS NULL OR user_id = ${userId ?? null}::uuid)
          AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
        ORDER BY created_at DESC
      `;
    });

    return rows.map((r) =>
      AdvisorTask.create({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        entityType: r.entity_type as any,
        entityId: r.entity_id,
        dueDate: r.due_date ? new Date(r.due_date) : null,
        status: r.status as any,
      }),
    );
  }

  // -------------------------------------------------------------
  // IInternalNoteRepository
  // -------------------------------------------------------------
  async saveNote(note: InternalNote): Promise<void> {
    const raw = note.toJSON();
    await withTenant(this.sql, { tenantId: raw.tenantId }, async (tx) => {
      await tx`
        INSERT INTO internal_notes (
          id, tenant_id, author_id, entity_type, entity_id, content, created_at
        ) VALUES (
          ${raw.id}::uuid,
          ${raw.tenantId}::uuid,
          ${raw.authorId ?? null}::uuid,
          ${raw.entityType},
          ${raw.entityId},
          ${raw.content},
          ${raw.createdAt.toISOString()}::timestamptz
        )
      `;
    });
  }

  async listByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<InternalNote[]> {
    const rows = await withTenant(this.sql, { tenantId }, async (tx) => {
      return await tx<
        {
          id: string;
          tenant_id: string;
          author_id: string | null;
          entity_type: string;
          entity_id: string;
          content: string;
          created_at: Date;
        }[]
      >`
        SELECT * FROM internal_notes
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY created_at DESC
      `;
    });

    return rows.map((r) =>
      InternalNote.create({
        id: r.id,
        tenantId: r.tenant_id,
        authorId: r.author_id,
        entityType: r.entity_type as any,
        entityId: r.entity_id,
        content: r.content,
        createdAt: new Date(r.created_at),
      }),
    );
  }
}
