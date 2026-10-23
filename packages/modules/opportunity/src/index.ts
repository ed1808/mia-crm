// Domain
export * from './domain/value-objects';
export * from './domain/events';
export * from './domain/control-group-policy';
export * from './domain/opportunity';
export * from './domain/opportunity-repository';
export * from './domain/rule-params-repository';
export * from './domain/contact-pressure-repository';
export * from './domain/rules/opportunity-rule';
export * from './domain/rules/rule-registry';
export * from './domain/rules/upcoming-maintenance-rule';
export * from './domain/rules/overdue-maintenance-rule';
export * from './domain/rules/churn-risk-rule';
export * from './domain/rules/upcoming-warranty-expiration-rule';
export * from './domain/rules/commercial-renewal-rule';
export * from './domain/rules/fleet-consolidation-rule';
export * from './domain/rules/regulatory-rtm-rule';

// Application
export * from './application/detect-opportunities.use-case';
export * from './application/update-opportunity-status.use-case';
export * from './application/manage-contact-pressure.use-case';

// Infrastructure
export * from './infrastructure/bun-sql-opportunity-repository';
export * from './infrastructure/bun-sql-rule-params-repository';
export * from './infrastructure/bun-sql-contact-pressure-repository';
