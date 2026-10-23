import { Result, DomainError } from '@mia-crm/kernel';
import { Party } from '../domain/party';
import { DocumentNumber, type DocumentType } from '../domain/value-objects';
import type { PartyRepository } from '../domain/party-repository';

export interface UpsertPartyFromErpDto {
  tenantId: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isCompany: boolean;
}

export class UpsertPartyFromErpUseCase {
  constructor(private readonly partyRepo: PartyRepository) {}

  async execute(dto: UpsertPartyFromErpDto): Promise<Result<{ partyId: string }, DomainError>> {
    // 1. Validar el número de documento como Value Object
    const docNumberResult = DocumentNumber.create(dto.documentNumber);
    if (!docNumberResult.ok) {
      return Result.fail(docNumberResult.error);
    }
    const docNumber = docNumberResult.value;
    const docType = (dto.documentType.toUpperCase() || 'CC') as DocumentType;

    // 2. Verificar si el titular fue suprimido bajo Ley 1581 (Decisiones D-31 y D-32)
    const isSuppressed = await this.partyRepo.isSuppressed(docType, docNumber.value);
    if (isSuppressed) {
      return Result.fail(
        new DomainError(
          'PARTY_SUPPRESSED',
          `El titular con documento ${docType} ${docNumber.value} solicitó supresión definitiva de datos. Reingreso bloqueado.`,
        ),
      );
    }

    // 3. Buscar si ya existe la entidad Party en el tenant
    let party = await this.partyRepo.findByIdentifier(docType, docNumber.value);

    if (party) {
      // Actualizar datos existentes
      if (party.partyType === 'company') {
        party.updateDetails({ legalName: dto.fullName, tradeName: dto.fullName });
      } else {
        const parts = dto.fullName.trim().split(/\s+/);
        const firstName = parts[0] || 'Persona';
        const lastName = parts.slice(1).join(' ');
        party.updateDetails({ firstName, lastName });
      }

      if (dto.email) {
        party.addOrUpdateContactPoint('email', dto.email.trim().toLowerCase(), true);
      }
      if (dto.phone) {
        party.addOrUpdateContactPoint('mobile', dto.phone.trim(), true);
      }
    } else {
      // Crear nueva entidad Party
      const isComp = dto.isCompany || docType === 'NIT';
      const parts = dto.fullName.trim().split(/\s+/);
      const firstName = isComp ? undefined : parts[0] || 'Persona';
      const lastName = isComp ? undefined : parts.slice(1).join(' ');
      const legalName = isComp ? dto.fullName.trim() : undefined;

      party = Party.create({
        tenantId: dto.tenantId,
        partyType: isComp ? 'company' : 'person',
        firstName,
        lastName,
        legalName,
        tradeName: legalName,
        identifier: {
          idType: docType,
          idNumber: docNumber,
        },
      });

      if (dto.email) {
        party.addOrUpdateContactPoint('email', dto.email.trim().toLowerCase(), true);
      }
      if (dto.phone) {
        party.addOrUpdateContactPoint('mobile', dto.phone.trim(), true);
      }
    }

    // 4. Persistir a través del repositorio
    await this.partyRepo.save(party);

    return Result.ok({ partyId: party.id });
  }
}
