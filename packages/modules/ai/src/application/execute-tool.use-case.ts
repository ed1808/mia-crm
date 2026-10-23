// packages/modules/ai/src/application/execute-tool.use-case.ts
import { DomainError, Result } from '@mia-crm/kernel';
import { AutonomyLevel } from '../domain/autonomy';
import { AiToolExecution } from '../domain/ai-execution';
import type { IAiToolRegistry, IAiExecutionRepository } from '../domain/ports';
import type { ToolExecutionContext } from '../domain/ai-tool';

export interface ExecuteToolInput {
  context: ToolExecutionContext;
  toolName: string;
  arguments: Record<string, any>;
}

export class ExecuteAiToolUseCase {
  constructor(
    private readonly toolRegistry: IAiToolRegistry,
    private readonly executionRepo: IAiExecutionRepository,
  ) {}

  async execute(input: ExecuteToolInput): Promise<Result<any, DomainError>> {
    const startTime = Date.now();
    const tool = this.toolRegistry.get(input.toolName);

    if (!tool) {
      return Result.fail(
        new DomainError(
          'TOOL_NOT_FOUND',
          `Herramienta IA '${input.toolName}' no encontrada en el registro gobernado`,
        ),
      );
    }

    // Nivel 3: Prohibido en el MVP (Decisión D-15)
    if (tool.autonomyLevel === AutonomyLevel.LEVEL_3_PROHIBITED) {
      const execution = AiToolExecution.create({
        tenantId: input.context.tenantId,
        userId: input.context.userId || null,
        role: input.context.role,
        taskType: input.context.taskType || 'T10',
        toolName: tool.name,
        autonomyLevel: AutonomyLevel.LEVEL_3_PROHIBITED,
        arguments: input.arguments,
        status: 'prohibited',
        rejectionReason: 'Acción estrictamente prohibida por política de autonomía D-15',
        durationMs: Date.now() - startTime,
      });
      await this.executionRepo.save(execution);

      return Result.fail(
        new DomainError(
          'TOOL_PROHIBITED',
          `Operación rechazada: La herramienta '${tool.name}' tiene Nivel 3 de autonomía y está prohibida en el MVP.`,
        ),
      );
    }

    // Nivel 2: Requiere Aprobación Humana previa (Decisión D-15)
    if (tool.autonomyLevel === AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL) {
      const toolRes = await tool.execute(input.context, input.arguments);
      const durationMs = Date.now() - startTime;

      if (!toolRes.ok) {
        return Result.fail(new DomainError('TOOL_EXECUTION_ERROR', String(toolRes.error)));
      }

      const execution = AiToolExecution.create({
        tenantId: input.context.tenantId,
        userId: input.context.userId || null,
        role: input.context.role,
        taskType: input.context.taskType || 'T4',
        toolName: tool.name,
        autonomyLevel: AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL,
        arguments: input.arguments,
        result: toolRes.value,
        status: 'pending_approval',
        durationMs,
      });

      await this.executionRepo.save(execution);

      return Result.ok({
        executionId: execution.id,
        status: 'pending_approval',
        autonomyLevel: 2,
        proposal: toolRes.value,
        message: 'Acción estructurada por la IA. Requiere tu confirmación antes de completarse.',
      });
    }

    // Nivel 0 (Lectura) o Nivel 1 (Escritura propia reversible): Auto-ejecución inmediata
    try {
      const toolRes = await tool.execute(input.context, input.arguments);
      const durationMs = Date.now() - startTime;

      if (!toolRes.ok) {
        const failedExecution = AiToolExecution.create({
          tenantId: input.context.tenantId,
          userId: input.context.userId || null,
          role: input.context.role,
          taskType: input.context.taskType || 'T6',
          toolName: tool.name,
          autonomyLevel: tool.autonomyLevel,
          arguments: input.arguments,
          status: 'failed',
          rejectionReason: String(toolRes.error),
          durationMs,
        });
        await this.executionRepo.save(failedExecution);
        return Result.fail(new DomainError('TOOL_EXECUTION_ERROR', String(toolRes.error)));
      }

      const execution = AiToolExecution.create({
        tenantId: input.context.tenantId,
        userId: input.context.userId || null,
        role: input.context.role,
        taskType: input.context.taskType || 'T6',
        toolName: tool.name,
        autonomyLevel: tool.autonomyLevel,
        arguments: input.arguments,
        result: toolRes.value,
        status: 'executed',
        durationMs,
      });

      await this.executionRepo.save(execution);

      return Result.ok({
        executionId: execution.id,
        status: 'executed',
        autonomyLevel: tool.autonomyLevel,
        data: toolRes.value,
      });
    } catch (err: any) {
      return Result.fail(
        new DomainError('UNEXPECTED_ERROR', err.message || 'Error inesperado al ejecutar tool IA'),
      );
    }
  }
}
