import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import { Lead } from '../../domain/lead';
import type { CommercialRepository } from '../../domain/commercial-repository';
import type { CreateLeadDto } from '../dto/commercial-dtos';

export class CreateLeadUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(tenantId: string, dto: CreateLeadDto): Promise<Result<Lead, DomainError>> {
    const leadResult = Lead.create(
      {
        tenantId,
        branchId: dto.branchId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        interestedVehicleModel: dto.interestedVehicleModel,
        notes: dto.notes,
        assignedTo: dto.assignedTo,
        slaMinutes: dto.slaMinutes,
      },
      this.clock
    );

    if (!leadResult.ok) {
      return leadResult;
    }

    const lead = leadResult.value;
    await this.repo.saveLead(lead);
    return Result.ok(lead);
  }
}
