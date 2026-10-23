// packages/modules/ai/src/infrastructure/tools/collaboration-tools.ts
import { Result } from '@mia-crm/kernel';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';
import { AdvisorTask, InternalNote } from '../../domain/collaboration';
import type { BunSqlAiRepository } from '../bun-sql-ai-repository';

export class CreateTaskForMeTool implements IAiTool {
  readonly name = 'create_task_for_me';
  readonly description =
    'Crea una tarea personal de seguimiento para el asesor (Nivel 1: Escritura reversible propia).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_1_REVERSIBLE_WRITE;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'title',
      type: 'string',
      description:
        'Título descriptivo de la acción a realizar (ej. Llamar a cliente para cotización)',
      required: true,
    },
    {
      name: 'description',
      type: 'string',
      description: 'Detalles adicionales o contexto',
      required: false,
    },
    {
      name: 'entityType',
      type: 'string',
      description: 'Entidad vinculada: vehicle, party, deal, opportunity, lead',
      required: false,
    },
    {
      name: 'entityId',
      type: 'string',
      description: 'ID o placa de la entidad relacionada',
      required: false,
    },
    {
      name: 'dueDate',
      type: 'string',
      description: 'Fecha límite de cumplimiento en formato ISO (ej. 2026-10-20T10:00:00Z)',
      required: false,
    },
  ];

  constructor(private readonly repo: BunSqlAiRepository) {}

  async execute(
    ctx: ToolExecutionContext,
    params: {
      title: string;
      description?: string;
      entityType?: any;
      entityId?: string;
      dueDate?: string;
    },
  ): Promise<Result<any, any>> {
    if (!params.title) {
      return Result.fail('El título de la tarea es obligatorio');
    }

    const task = AdvisorTask.create({
      tenantId: ctx.tenantId,
      userId: ctx.userId || null,
      title: params.title,
      description: params.description || null,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
      status: 'pending',
    });

    await this.repo.saveTask(task);

    return Result.ok({
      message: 'Tarea creada exitosamente en su bandeja de actividades',
      task: task.toJSON(),
    });
  }
}

export class AddNoteTool implements IAiTool {
  readonly name = 'add_note';
  readonly description =
    'Agrega una nota interna contextual sobre un vehículo, cliente, oportunidad o lead (Nivel 1: Escritura reversible propia).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_1_REVERSIBLE_WRITE;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'entityType',
      type: 'string',
      description: 'Tipo de entidad: vehicle, party, deal, opportunity, lead',
      required: true,
    },
    {
      name: 'entityId',
      type: 'string',
      description: 'Identificador único o placa de la entidad',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Texto de la nota interna',
      required: true,
    },
  ];

  constructor(private readonly repo: BunSqlAiRepository) {}

  async execute(
    ctx: ToolExecutionContext,
    params: { entityType: any; entityId: string; content: string },
  ): Promise<Result<any, any>> {
    if (!params.entityType || !params.entityId || !params.content) {
      return Result.fail('Los campos entityType, entityId y content son obligatorios');
    }

    const note = InternalNote.create({
      tenantId: ctx.tenantId,
      authorId: ctx.userId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      content: params.content,
    });

    await this.repo.saveNote(note);

    return Result.ok({
      message: 'Nota interna agregada correctamente',
      note: note.toJSON(),
    });
  }
}
