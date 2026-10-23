import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import type { CommercialRepository } from '../../domain/commercial-repository';
import type { Lead } from '../../domain/lead';

export class ContactLeadUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(leadId: string): Promise<Result<Lead, DomainError>> {
    const lead = await this.repo.findLeadById(leadId);
    if (!lead) {
      return Result.fail(new DomainError('LEAD_NOT_FOUND', `Lead con ID ${leadId} no encontrado`));
    }

    const contactResult = lead.recordFirstContact(this.clock);
    if (!contactResult.ok) {
      return contactResult;
    }

    await this.repo.saveLead(lead);
    return Result.ok(lead);
  }
}
