import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import type { CommercialRepository } from '../../domain/commercial-repository';
import { Deal } from '../../domain/deal';
import type { ConvertLeadDto } from '../dto/commercial-dtos';

export class ConvertLeadToDealUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(
    tenantId: string,
    dto: ConvertLeadDto,
    partyId: string
  ): Promise<Result<{ deal: Deal }, DomainError>> {
    const lead = await this.repo.findLeadById(dto.leadId);
    if (!lead) {
      return Result.fail(new DomainError('LEAD_NOT_FOUND', `Lead con ID ${dto.leadId} no encontrado`));
    }

    // Buscar pipeline (o usar el default)
    let pipeline = dto.pipelineId ? await this.repo.findPipelineById(dto.pipelineId) : undefined;
    if (!pipeline) {
      const pipelines = await this.repo.findPipelines();
      pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
    }

    if (!pipeline) {
      return Result.fail(new DomainError('PIPELINE_NOT_FOUND', 'No se encontró un pipeline configurado'));
    }

    const stage = dto.stageId ? pipeline.findStage(dto.stageId) : pipeline.getInitialStage();
    if (!stage) {
      return Result.fail(new DomainError('STAGE_NOT_FOUND', 'No se encontró una etapa válida para la oportunidad'));
    }

    const dealTitle =
      dto.dealTitle ??
      `Interés: ${lead.interestedVehicleModel || 'Vehículo'} — ${lead.fullName}`;

    const dealResult = Deal.create(
      {
        tenantId,
        branchId: lead.branchId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: dealTitle,
        partyId,
        leadId: lead.id,
        assignedTo: lead.assignedTo,
        estimatedValue: dto.estimatedValue ?? 0,
      },
      this.clock
    );

    if (!dealResult.ok) {
      return dealResult;
    }

    const deal = dealResult.value;

    const convertResult = lead.convert(partyId, deal.id, this.clock);
    if (!convertResult.ok) {
      return convertResult;
    }

    await this.repo.saveLead(lead);
    await this.repo.saveDeal(deal);

    return Result.ok({ deal });
  }
}
