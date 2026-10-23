import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import type { CommercialRepository } from '../../domain/commercial-repository';
import { Quote } from '../../domain/quote';
import type { CreateQuoteDto } from '../dto/commercial-dtos';

export class CreateQuoteUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(tenantId: string, dto: CreateQuoteDto): Promise<Result<Quote, DomainError>> {
    const deal = await this.repo.findDealById(dto.dealId);
    if (!deal) {
      return Result.fail(new DomainError('DEAL_NOT_FOUND', `Oportunidad con ID ${dto.dealId} no encontrada`));
    }

    const quoteNumber =
      dto.quoteNumber ??
      `COT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const quoteResult = Quote.create(
      {
        tenantId,
        dealId: deal.id,
        quoteNumber,
        items: dto.items,
        discountAmount: dto.discountAmount,
        tradeInAllowance: dto.tradeInAllowance,
        paymentTerms: dto.paymentTerms,
        validDays: dto.validDays,
        notes: dto.notes,
      },
      this.clock
    );

    if (!quoteResult.ok) {
      return quoteResult;
    }

    const quote = quoteResult.value;
    await this.repo.saveQuote(quote);

    // Actualizar el valor estimado del Deal con el valor neto de la cotización
    if (quote.latestVersion) {
      deal.updateEstimatedValue(quote.latestVersion.netAmount, this.clock);
      await this.repo.saveDeal(deal);
    }

    return Result.ok(quote);
  }
}
