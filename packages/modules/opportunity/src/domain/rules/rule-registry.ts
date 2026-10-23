import type { RuleId } from '../value-objects';
import { ChurnRiskMaintenanceRule } from './churn-risk-rule';
import { CommercialRenewalRule } from './commercial-renewal-rule';
import { FleetConsolidationRule } from './fleet-consolidation-rule';
import type { OpportunityRule } from './opportunity-rule';
import { OverdueMaintenanceRule } from './overdue-maintenance-rule';
import { RegulatoryRtmDueRule } from './regulatory-rtm-rule';
import { UpcomingMaintenanceRule } from './upcoming-maintenance-rule';
import { UpcomingWarrantyExpirationRule } from './upcoming-warranty-expiration-rule';

export class RuleRegistry {
  private readonly rules = new Map<RuleId, OpportunityRule>();

  constructor() {
    this.register(new UpcomingMaintenanceRule());
    this.register(new OverdueMaintenanceRule());
    this.register(new ChurnRiskMaintenanceRule());
    this.register(new UpcomingWarrantyExpirationRule());
    this.register(new CommercialRenewalRule());
    this.register(new FleetConsolidationRule());
    this.register(new RegulatoryRtmDueRule());
  }

  register(rule: OpportunityRule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: RuleId): OpportunityRule | undefined {
    return this.rules.get(id);
  }

  getAll(): OpportunityRule[] {
    return Array.from(this.rules.values());
  }
}
