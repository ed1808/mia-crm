// packages/modules/ai/src/application/approve-execution.use-case.ts
import { DomainError, Result } from '@mia-crm/kernel';
import type { IAiExecutionRepository } from '../domain/ports';

export interface ApproveExecutionInput {
  tenantId: string;
  executionId: string;
  userId?: string | null;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export class ApproveExecutionUseCase {
  constructor(private readonly executionRepo: IAiExecutionRepository) {}

  async execute(input: ApproveExecutionInput): Promise<Result<any, DomainError>> {
    const execution = await this.executionRepo.findById(input.tenantId, input.executionId);
    if (!execution) {
      return Result.fail(new DomainError('EXECUTION_NOT_FOUND', 'Ejecución de tool no encontrada'));
    }

    if (execution.tenantId !== input.tenantId) {
      return Result.fail(new DomainError('Aislamiento RLS: Ejecución no pertenece a este tenant'));
    }

    if (input.action === 'reject') {
      const rejectRes = execution.reject(
        input.userId,
        input.rejectionReason || 'Rechazado por el usuario',
      );
      if (!rejectRes.ok) {
        return Result.fail(new DomainError('REJECT_ERROR', String(rejectRes.error)));
      }
      await this.executionRepo.save(execution);
      return Result.ok({
        executionId: execution.id,
        status: 'rejected',
        message: 'Propuesta de la IA rechazada.',
      });
    }

    const approveRes = execution.approve(input.userId, {
      ...execution.result,
      approvedActionTaken: true,
      executedAt: new Date().toISOString(),
    });

    if (!approveRes.ok) {
      return Result.fail(new DomainError('APPROVE_ERROR', String(approveRes.error)));
    }

    await this.executionRepo.save(execution);

    return Result.ok({
      executionId: execution.id,
      status: 'approved',
      message: 'Acción aprobada y confirmada exitosamente.',
      data: execution.result,
    });
  }
}
