import { type Clock, DomainError, Result, SystemClock } from '@mia-crm/kernel';
import { ControlGroupPolicy } from '../domain/control-group-policy';
import { Opportunity } from '../domain/opportunity';
import type { OpportunityRepository } from '../domain/opportunity-repository';
import type { RuleParamsRepository } from '../domain/rule-params-repository';
import type { ProjectionData, VehicleContext } from '../domain/rules/opportunity-rule';
import { RuleRegistry } from '../domain/rules/rule-registry';

export interface DetectOpportunitiesInput {
  tenantId: string;
  vehicle: VehicleContext;
  projection?: ProjectionData;
  lastVisitDate?: Date;
  fleetUnitCount?: number;
}

export class DetectOpportunitiesUseCase {
  constructor(
    private readonly opportunityRepo: OpportunityRepository,
    private readonly ruleRegistry: RuleRegistry = new RuleRegistry(),
    private readonly ruleParamsRepo?: RuleParamsRepository,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async execute(input: DetectOpportunitiesInput): Promise<Result<Opportunity[], DomainError>> {
    const { vehicle, tenantId } = input;

    if (!vehicle.primaryOwnerPartyId) {
      return Result.fail(
        new DomainError(
          'VEHICLE_NO_OWNER',
          `El vehículo ${vehicle.id} no tiene un titular/propietario primario activo asignado.`,
        ),
      );
    }

    const now = this.clock.now();
    const rules = this.ruleRegistry.getAll();
    const createdOpportunities: Opportunity[] = [];

    const evalContext = {
      vehicle,
      projection: input.projection,
      lastVisitDate: input.lastVisitDate,
      now,
      fleetUnitCount: input.fleetUnitCount,
    };

    for (const rule of rules) {
      // 1. Obtener parámetros personalizados por tenant si existen
      let params: Record<string, unknown> | undefined;
      if (this.ruleParamsRepo) {
        const customParams = await this.ruleParamsRepo.getParams(rule.id, rule.version);
        if (customParams) {
          params = customParams;
        }
      }

      // 2. Evaluar regla
      const evalResult = rule.evaluate(evalContext, params);
      if (!evalResult) {
        continue;
      }

      // 3. Deduplicación: no generar si ya existe una oportunidad activa para esta regla y vehículo
      const activeExisting = await this.opportunityRepo.findActiveByVehicleAndRule(
        vehicle.id,
        rule.id,
      );
      if (activeExisting) {
        continue;
      }

      // 4. Asignación determinista a grupo de control del 15% (D-39)
      // Si es flota, se aleatoriza por ID de flota; de lo contrario por vehículo
      const entityIdForControl = vehicle.fleetId ?? vehicle.id;
      const isControlGroup = ControlGroupPolicy.isControlGroup(entityIdForControl);

      // 5. Crear agregado de Oportunidad
      const opportunity = Opportunity.create({
        tenantId,
        ruleId: evalResult.ruleId,
        ruleVersion: evalResult.ruleVersion,
        vehicleId: vehicle.id,
        partyId: vehicle.primaryOwnerPartyId,
        score: evalResult.score,
        valueEstimate: evalResult.valueEstimate,
        evidence: evalResult.evidence,
        isControlGroup,
        expiresAt: evalResult.expiresAt,
      });

      // 6. Persistir y emitir eventos outbox
      await this.opportunityRepo.save(opportunity);
      createdOpportunities.push(opportunity);
    }

    return Result.ok(createdOpportunities);
  }
}
