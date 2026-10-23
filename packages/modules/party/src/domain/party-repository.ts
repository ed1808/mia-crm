import type { Party } from './party';

export interface PartyRepository {
  save(party: Party): Promise<void>;
  findById(id: string): Promise<Party | null>;
  findByIdentifier(idType: string, idNumber: string): Promise<Party | null>;
  isSuppressed(idType: string, idNumber: string): Promise<boolean>;
  suppress(idType: string, idNumber: string, reason: string): Promise<void>;
}
