export type ProjectionMethod = 'own_history' | 'cohort' | 'plan';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface HistoricalVisit {
  enteredAt: Date;
  mileage?: number;
  operatingHours?: number;
  orderType: string;
}

export interface ProjectionContext {
  vehicleId: string;
  tenantId: string;
  vehicleType: string; // 'passenger', 'commercial_heavy', etc.
  currentMileage?: number;
  currentOperatingHours?: number;
  visits: HistoricalVisit[];
  lastVisitDate?: Date;
  referenceDate?: Date; // Reloj inyectable para cálculos temporales
}
