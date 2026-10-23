import { Result, DomainError } from '@mia-crm/kernel';
import type { PartyRepository } from '../domain/party-repository';

export interface SuppressPartyDto {
  partyId: string;
  reason: string;
}

export class SuppressPartyUseCase {
  constructor(private readonly partyRepo: PartyRepository) {}

  async execute(dto: SuppressPartyDto): Promise<Result<void, DomainError>> {
    // 1. Encontrar el Party existente
    const party = await this.partyRepo.findById(dto.partyId);
    if (!party) {
      return Result.fail(
        new DomainError('PARTY_NOT_FOUND', `Tercero no encontrado: ${dto.partyId}`),
      );
    }

    // 2. Para cada identificador del titular, registrar el hash de supresión y eliminarlo completamente
    for (const ident of party.identifiers) {
      await this.partyRepo.suppress(ident.idType, ident.idNumber.value, dto.reason);
    }

    return Result.ok(undefined);
  }
}
