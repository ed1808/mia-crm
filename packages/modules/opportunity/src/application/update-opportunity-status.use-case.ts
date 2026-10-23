import { type Clock, DomainError, Result, SystemClock } from '@mia-crm/kernel';
import type { ContactPressureRepository } from '../domain/contact-pressure-repository';
import type { Opportunity } from '../domain/opportunity';
import type { OpportunityRepository } from '../domain/opportunity-repository';

export interface UpdateOpportunityStatusInput {
  opportunityId: string;
  action: 'start_progress' | 'request_appointment' | 'convert' | 'reject' | 'expire';
  rejectionReason?: string;
  convertedAt?: Date;
}

export class UpdateOpportunityStatusUseCase {
  constructor(
    private readonly opportunityRepo: OpportunityRepository,
    private readonly contactPressureRepo?: ContactPressureRepository,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async execute(input: UpdateOpportunityStatusInput): Promise<Result<Opportunity, DomainError>> {
    const opp = await this.opportunityRepo.findById(input.opportunityId);
    if (!opp) {
      return Result.fail(
        new DomainError(
          'OPPORTUNITY_NOT_FOUND',
          `Oportunidad con ID ${input.opportunityId} no encontrada.`,
        ),
      );
    }

    const now = this.clock.now();

    switch (input.action) {
      case 'start_progress':
        opp.startProgress();
        break;
      case 'request_appointment':
        opp.requestAppointment();
        break;
      case 'convert':
        opp.convert(input.convertedAt ?? now);
        break;
      case 'reject': {
        const reason = input.rejectionReason ?? 'Rechazado por el cliente';
        opp.reject(reason);

        // Decisión D-38: Cooldown de 45 días tras rechazo
        if (this.contactPressureRepo) {
          const cooldownUntil = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
          const channels = ['whatsapp', 'call', 'email', 'sms'];
          for (const channel of channels) {
            await this.contactPressureRepo.recordContact(opp.partyId, channel, now, cooldownUntil);
          }
        }
        break;
      }
      case 'expire':
        opp.expire();
        break;
    }

    await this.opportunityRepo.save(opp);
    return Result.ok(opp);
  }
}
