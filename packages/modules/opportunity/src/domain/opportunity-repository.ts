import type { Opportunity } from './opportunity';
import type { OpportunityStatus, RuleId } from './value-objects';

export interface OpportunityFilter {
  tenantId?: string;
  vehicleId?: string;
  partyId?: string;
  ruleId?: RuleId;
  status?: OpportunityStatus | OpportunityStatus[];
  isControlGroup?: boolean;
  limit?: number;
  offset?: number;
}

export interface OpportunityRepository {
  save(opportunity: Opportunity): Promise<void>;
  findById(id: string): Promise<Opportunity | null>;
  findActiveByVehicleAndRule(vehicleId: string, ruleId: RuleId): Promise<Opportunity | null>;
  findByVehicleId(vehicleId: string): Promise<Opportunity[]>;
  find(filter?: OpportunityFilter): Promise<Opportunity[]>;
}
