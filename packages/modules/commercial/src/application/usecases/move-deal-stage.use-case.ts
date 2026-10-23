import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import type { CommercialRepository } from '../../domain/commercial-repository';
import type { Deal } from '../../domain/deal';
import type { MoveDealStageDto } from '../dto/commercial-dtos';

export class MoveDealStageUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(dto: MoveDealStageDto): Promise<Result<Deal, DomainError>> {
    const deal = await this.repo.findDealById(dto.dealId);
    if (!deal) {
      return Result.fail(new DomainError('DEAL_NOT_FOUND', `Oportunidad con ID ${dto.dealId} no encontrada`));
    }

    const pipeline = await this.repo.findPipelineById(deal.pipelineId);
    if (!pipeline) {
      return Result.fail(new DomainError('PIPELINE_NOT_FOUND', 'Pipeline de la oportunidad no encontrado'));
    }

    const targetStage = pipeline.findStage(dto.newStageId);
    if (!targetStage) {
      return Result.fail(new DomainError('STAGE_NOT_FOUND', `Etapa destino con ID ${dto.newStageId} no existe en el pipeline`));
    }

    const moveResult = deal.moveToStage(
      {
        newStageId: targetStage.id,
        isWon: targetStage.isWon,
        isLost: targetStage.isLost,
        lossReason: dto.lossReason,
      },
      this.clock
    );

    if (!moveResult.ok) {
      return moveResult;
    }

    await this.repo.saveDeal(deal);
    return Result.ok(deal);
  }
}
