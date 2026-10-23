// packages/modules/ai/src/index.ts
// Public API for @mia-crm/module-ai (Decisiones D-14, D-15, D-16, D-24, D-26, D-30, D-36)

// 1. Dominio: Autonomía, Contratos y Entidades
export {
  AutonomyLevel,
  DefaultAutonomyPolicy,
  type ToolExecutionStatus,
  type AutonomyPolicy,
} from './domain/autonomy';

export type {
  IAiTool,
  ToolExecutionContext,
  ToolParameterDefinition,
  ToolMetadata,
} from './domain/ai-tool';

export {
  AiToolExecution,
  type AiToolExecutionProps,
} from './domain/ai-execution';

export {
  AdvisorTask,
  InternalNote,
  type AdvisorTaskProps,
  type InternalNoteProps,
} from './domain/collaboration';

export {
  ROLE_PROMPTS,
  type RolePromptDefinition,
} from './domain/prompt-catalog';

export { AiToolRegistry } from './domain/tool-registry';

export type {
  IAiToolRegistry,
  IAiExecutionRepository,
  IAdvisorTaskRepository,
  IInternalNoteRepository,
  ILlmProvider,
  LlmMessage,
  LlmToolCall,
  LlmCompletionResponse,
} from './domain/ports';

// 2. Casos de Uso (Application Layer)
export {
  ExecuteAiToolUseCase,
  type ExecuteToolInput,
} from './application/execute-tool.use-case';

export {
  ApproveExecutionUseCase,
  type ApproveExecutionInput,
} from './application/approve-execution.use-case';

export {
  CopilotChatUseCase,
  type CopilotChatInput,
  type CopilotChatOutput,
  type CopilotToolExecutionReport,
} from './application/copilot-chat.use-case';

// 3. Infraestructura: Repositorios, LLM Gateway & Tools Gobernadas
export { BunSqlAiRepository } from './infrastructure/bun-sql-ai-repository';
export { MockLlmProvider, GeminiLlmProvider } from './infrastructure/llm/llm-provider';

export {
  QueryMetricTool,
  ExplainMetricTool,
} from './infrastructure/tools/governed-metrics-tools';

export {
  GetVehicle360Tool,
  GetMaintenanceStatusTool,
} from './infrastructure/tools/vehicle-context-tools';

export {
  ListMyLeadsTool,
  ListMyOpportunitiesTool,
  GetCustomer360Tool,
} from './infrastructure/tools/commercial-tools';

export {
  CreateTaskForMeTool,
  AddNoteTool,
} from './infrastructure/tools/collaboration-tools';

export {
  DraftMessageTool,
  RequestAppointmentTool,
  CreateOpportunityTool,
} from './infrastructure/tools/approval-tools';

export { ProhibitedActionTool } from './infrastructure/tools/prohibited-tools';
