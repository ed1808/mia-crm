// packages/modules/ai/src/domain/ai-tool.ts
import type { Result } from '@mia-crm/kernel';
import type { AutonomyLevel } from './autonomy';

export interface ToolExecutionContext {
  tenantId: string;
  userId?: string | null;
  role: string;
  taskType?: string; // T1..T11
}

export interface ToolParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface IAiTool<TParams = any, TResult = any> {
  readonly name: string;
  readonly description: string;
  readonly autonomyLevel: AutonomyLevel;
  readonly parameters: ToolParameterDefinition[];

  execute(ctx: ToolExecutionContext, params: TParams): Promise<Result<TResult, any>>;
}

export interface ToolMetadata {
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  parameters: ToolParameterDefinition[];
}
