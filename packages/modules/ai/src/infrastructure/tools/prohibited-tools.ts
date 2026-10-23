// packages/modules/ai/src/infrastructure/tools/prohibited-tools.ts
import { Result } from '@mia-crm/kernel';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';

export class ProhibitedActionTool implements IAiTool {
  readonly name = 'prohibited_security_action';
  readonly description =
    'Herramienta de prueba que modela acciones prohibidas en el MVP (Nivel 3: Prohibido - Decisión D-15).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_3_PROHIBITED;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'actionType',
      type: 'string',
      description: 'delete_data, financial_transfer, confirm_ownership_change',
      required: true,
    },
  ];

  async execute(
    _ctx: ToolExecutionContext,
    params: { actionType: string },
  ): Promise<Result<any, any>> {
    return Result.fail(
      `Acción prohibida por política de autonomía D-15 (Nivel 3): '${params.actionType}'. Esta operación requiere ejecución humana directa fuera de la IA.`,
    );
  }
}
