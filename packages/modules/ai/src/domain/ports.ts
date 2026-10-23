// packages/modules/ai/src/domain/ports.ts
import type { Result } from '@mia-crm/kernel';
import type { IAiTool, ToolMetadata } from './ai-tool';
import type { AiToolExecution } from './ai-execution';
import type { AdvisorTask, InternalNote } from './collaboration';

export interface IAiToolRegistry {
  register(tool: IAiTool): void;
  get(name: string): IAiTool | undefined;
  listForRole(role: string): ToolMetadata[];
  listAll(): ToolMetadata[];
}

export interface IAiExecutionRepository {
  save(execution: AiToolExecution): Promise<void>;
  findById(tenantId: string, id: string): Promise<AiToolExecution | null>;
  listRecent(tenantId: string, limit?: number): Promise<AiToolExecution[]>;
  listPendingApprovals(tenantId: string): Promise<AiToolExecution[]>;
}

export interface IAdvisorTaskRepository {
  save(task: AdvisorTask): Promise<void>;
  listByUser(tenantId: string, userId: string | null, status?: string): Promise<AdvisorTask[]>;
}

export interface IInternalNoteRepository {
  save(note: InternalNote): Promise<void>;
  listByEntity(tenantId: string, entityType: string, entityId: string): Promise<InternalNote[]>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LlmCompletionResponse {
  content: string;
  toolCalls?: LlmToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILlmProvider {
  readonly providerName: string;
  complete(
    messages: LlmMessage[],
    tools?: ToolMetadata[],
  ): Promise<Result<LlmCompletionResponse, Error>>;
}
