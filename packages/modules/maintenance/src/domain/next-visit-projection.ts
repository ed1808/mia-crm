import { AggregateRoot } from '@mia-crm/kernel';
import type { ProjectionMethod, ConfidenceLevel } from './value-objects';
import { NextVisitProjectedDomainEvent } from './events';

export interface NextVisitProjectionProps {
  id: string;
  tenantId: string;
  vehicleId: string;
  projectedDate: Date;
  projectedMileage?: number;
  projectionMethod: ProjectionMethod;
  confidenceLevel: ConfidenceLevel;
  calculationBasis: Record<string, unknown>;
  calculatedAt: Date;
}

export class NextVisitProjection extends AggregateRoot<string> {
  private _projectedDate: Date;
  private _projectedMileage?: number;
  private _projectionMethod: ProjectionMethod;
  private _confidenceLevel: ConfidenceLevel;
  private _calculationBasis: Record<string, unknown>;
  private _calculatedAt: Date;

  private constructor(
    id: string,
    readonly tenantId: string,
    readonly vehicleId: string,
    props: Omit<NextVisitProjectionProps, 'id' | 'tenantId' | 'vehicleId'>,
  ) {
    super(id);
    this._projectedDate = props.projectedDate;
    this._projectedMileage = props.projectedMileage;
    this._projectionMethod = props.projectionMethod;
    this._confidenceLevel = props.confidenceLevel;
    this._calculationBasis = { ...props.calculationBasis };
    this._calculatedAt = props.calculatedAt;
  }

  static create(props: {
    id?: string;
    tenantId: string;
    vehicleId: string;
    projectedDate: Date;
    projectedMileage?: number;
    projectionMethod: ProjectionMethod;
    confidenceLevel: ConfidenceLevel;
    calculationBasis: Record<string, unknown>;
    calculatedAt?: Date;
  }): NextVisitProjection {
    const id = props.id ?? crypto.randomUUID();
    const calculatedAt = props.calculatedAt ?? new Date();

    const proj = new NextVisitProjection(id, props.tenantId, props.vehicleId, {
      projectedDate: props.projectedDate,
      projectedMileage: props.projectedMileage,
      projectionMethod: props.projectionMethod,
      confidenceLevel: props.confidenceLevel,
      calculationBasis: props.calculationBasis,
      calculatedAt,
    });

    proj.addDomainEvent(
      new NextVisitProjectedDomainEvent(
        id,
        {
          vehicleId: props.vehicleId,
          tenantId: props.tenantId,
          projectedDate: props.projectedDate.toISOString().split('T')[0]!,
          projectedMileage: props.projectedMileage ?? null,
          projectionMethod: props.projectionMethod,
          confidenceLevel: props.confidenceLevel,
          calculationBasis: props.calculationBasis,
          calculatedAt: calculatedAt.toISOString(),
        },
        calculatedAt,
      ),
    );

    return proj;
  }

  static reconstitute(props: NextVisitProjectionProps): NextVisitProjection {
    return new NextVisitProjection(props.id, props.tenantId, props.vehicleId, props);
  }

  get projectedDate(): Date {
    return this._projectedDate;
  }

  get projectedMileage(): number | undefined {
    return this._projectedMileage;
  }

  get projectionMethod(): ProjectionMethod {
    return this._projectionMethod;
  }

  get confidenceLevel(): ConfidenceLevel {
    return this._confidenceLevel;
  }

  get calculationBasis(): Record<string, unknown> {
    return { ...this._calculationBasis };
  }

  get calculatedAt(): Date {
    return this._calculatedAt;
  }

  update(params: {
    projectedDate: Date;
    projectedMileage?: number;
    projectionMethod: ProjectionMethod;
    confidenceLevel: ConfidenceLevel;
    calculationBasis: Record<string, unknown>;
    calculatedAt?: Date;
  }): void {
    const now = params.calculatedAt ?? new Date();
    this._projectedDate = params.projectedDate;
    this._projectedMileage = params.projectedMileage;
    this._projectionMethod = params.projectionMethod;
    this._confidenceLevel = params.confidenceLevel;
    this._calculationBasis = { ...params.calculationBasis };
    this._calculatedAt = now;

    this.addDomainEvent(
      new NextVisitProjectedDomainEvent(
        this.id,
        {
          vehicleId: this.vehicleId,
          tenantId: this.tenantId,
          projectedDate: params.projectedDate.toISOString().split('T')[0]!,
          projectedMileage: params.projectedMileage ?? null,
          projectionMethod: params.projectionMethod,
          confidenceLevel: params.confidenceLevel,
          calculationBasis: params.calculationBasis,
          calculatedAt: now.toISOString(),
        },
        now,
      ),
    );
  }
}
