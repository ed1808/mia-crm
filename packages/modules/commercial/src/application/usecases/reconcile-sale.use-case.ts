import { DomainError, Result, type Clock } from '@mia-crm/kernel';
import type { CommercialRepository } from '../../domain/commercial-repository';
import { Sale } from '../../domain/sale';
import type { ReconcileSaleDto } from '../dto/commercial-dtos';

export class ReconcileSaleWithErpUseCase {
  constructor(
    private readonly repo: CommercialRepository,
    private readonly clock: Clock
  ) {}

  async execute(tenantId: string, dto: ReconcileSaleDto): Promise<Result<Sale, DomainError>> {
    const saleDate = new Date(dto.saleDate);
    const deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate) : undefined;

    const saleResult = Sale.create(
      {
        tenantId,
        branchId: dto.branchId,
        dealId: dto.dealId,
        quoteId: dto.quoteId,
        vehicleId: dto.vehicleId,
        customerPartyId: dto.customerPartyId,
        externalOrderNumber: dto.externalOrderNumber,
        externalInvoiceNumber: dto.externalInvoiceNumber,
        saleAmount: dto.saleAmount,
        saleDate,
        deliveryDate,
      },
      this.clock
    );

    if (!saleResult.ok) {
      return saleResult;
    }

    const sale = saleResult.value;
    await this.repo.saveSale(sale);

    // Si está vinculada a una cotización, marcarla como conciliada
    if (dto.quoteId) {
      const quote = await this.repo.findQuoteById(dto.quoteId);
      if (quote) {
        quote.markAsReconciled(this.clock);
        await this.repo.saveQuote(quote);
      }
    }

    // Si está vinculada a un Deal, marcar el Deal como ganado
    if (dto.dealId) {
      const deal = await this.repo.findDealById(dto.dealId);
      if (deal) {
        const pipeline = await this.repo.findPipelineById(deal.pipelineId);
        const wonStage = pipeline?.stages.find((s) => s.isWon);
        if (wonStage) {
          deal.moveToStage(
            {
              newStageId: wonStage.id,
              isWon: true,
              isLost: false,
            },
            this.clock
          );
          await this.repo.saveDeal(deal);
        }
      }
    }

    return Result.ok(sale);
  }
}
