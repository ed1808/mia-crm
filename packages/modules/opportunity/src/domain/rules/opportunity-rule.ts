import type { RuleId, Score } from '../value-objects';

export interface VehicleContext {
  id: string;
  tenantId: string;
  vin?: string;
  plate?: string;
  make: string;
  model: string;
  modelYear?: number;
  vehicleType: string;
  currentMileage?: number;
  currentOperatingHours?: number;
  warrantyEndDate?: Date;
  rtmDueDate?: Date;
  primaryOwnerPartyId?: string;
  isCompanyOwner: boolean;
  fleetId?: string;
}

export interface ProjectionData {
  projectedDate: Date;
  projectedMileage?: number;
  projectionMethod: string;
  confidenceLevel: string;
}

export interface RuleEvaluationContext {
  vehicle: VehicleContext;
  projection?: ProjectionData;
  lastVisitDate?: Date;
  now: Date; // Reloj inyectable
  fleetUnitCount?: number; // Para R-FLT-01
}

export interface RuleEvaluationResult {
  ruleId: RuleId;
  ruleVersion: number;
  score: Score;
  valueEstimate: number;
  evidence: Record<string, unknown>;
  expiresAt: Date;
}

export interface OpportunityRule {
  readonly id: RuleId;
  readonly version: number;
  evaluate(
    ctx: RuleEvaluationContext,
    params?: Record<string, unknown>,
  ): RuleEvaluationResult | null;
}
