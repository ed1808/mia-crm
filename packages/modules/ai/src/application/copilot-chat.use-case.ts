// packages/modules/ai/src/application/copilot-chat.use-case.ts
import { DomainError, Result } from '@mia-crm/kernel';
import { ROLE_PROMPTS } from '../domain/prompt-catalog';
import type { IAiToolRegistry, ILlmProvider, LlmMessage } from '../domain/ports';
import type { ExecuteAiToolUseCase } from './execute-tool.use-case';

export interface CopilotChatInput {
  tenantId: string;
  userId?: string | null;
  role: 'sales_advisor' | 'service_advisor' | 'executive_manager' | 'general';
  message: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface CopilotToolExecutionReport {
  toolName: string;
  autonomyLevel: number;
  status: string;
  data?: any;
  proposal?: any;
  executionId?: string;
}

export interface CopilotChatOutput {
  response: string;
  role: string;
  toolExecutions: CopilotToolExecutionReport[];
  pendingApprovals: any[];
}

export class CopilotChatUseCase {
  constructor(
    private readonly toolRegistry: IAiToolRegistry,
    private readonly executeToolUseCase: ExecuteAiToolUseCase,
    private readonly llmProvider: ILlmProvider,
  ) {}

  async execute(input: CopilotChatInput): Promise<Result<CopilotChatOutput, DomainError>> {
    const roleDef = ROLE_PROMPTS[input.role] || ROLE_PROMPTS.sales_advisor;
    const tools = this.toolRegistry.listForRole(roleDef.role);

    // Construir mensajes para el LLM
    const messages: LlmMessage[] = [{ role: 'system', content: roleDef.systemPrompt }];

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      for (const h of input.conversationHistory.slice(-6)) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: input.message });

    // Primer llamado al LLM
    const llmRes = await this.llmProvider.complete(messages, tools);
    if (!llmRes.ok) {
      return Result.fail(new DomainError(`Error de LLM: ${llmRes.error.message}`));
    }

    const firstCompletion = llmRes.value;
    const toolExecutions: CopilotToolExecutionReport[] = [];
    const pendingApprovals: any[] = [];

    // Si el LLM no llamó herramientas, retornamos directamente
    if (!firstCompletion.toolCalls || firstCompletion.toolCalls.length === 0) {
      return Result.ok({
        response: firstCompletion.content,
        role: roleDef.role,
        toolExecutions: [],
        pendingApprovals: [],
      });
    }

    // Ejecutar cada herramienta llamada bajo el contexto de tenant y usuario
    for (const toolCall of firstCompletion.toolCalls) {
      const execRes = await this.executeToolUseCase.execute({
        context: {
          tenantId: input.tenantId,
          userId: input.userId,
          role: roleDef.role,
        },
        toolName: toolCall.name,
        arguments: toolCall.arguments,
      });

      if (execRes.ok) {
        const val = execRes.value;
        toolExecutions.push({
          toolName: toolCall.name,
          autonomyLevel: val.autonomyLevel,
          status: val.status,
          data: val.data,
          proposal: val.proposal,
          executionId: val.executionId,
        });

        if (val.status === 'pending_approval') {
          pendingApprovals.push({
            executionId: val.executionId,
            toolName: toolCall.name,
            proposal: val.proposal,
            message: val.message,
          });
        }

        // Agregar el resultado de la tool para que el LLM lo interprete
        messages.push({
          role: 'tool',
          name: toolCall.name,
          toolCallId: toolCall.id,
          content: JSON.stringify(val.data || val.proposal),
        });
      } else {
        toolExecutions.push({
          toolName: toolCall.name,
          autonomyLevel: 0,
          status: 'failed',
          data: { error: execRes.error.message },
        });

        messages.push({
          role: 'tool',
          name: toolCall.name,
          toolCallId: toolCall.id,
          content: `Error al ejecutar herramienta: ${execRes.error.message}`,
        });
      }
    }

    // Segundo llamado al LLM para sintetizar los datos de las herramientas en una respuesta final
    const finalLlmRes = await this.llmProvider.complete(messages, tools);
    const finalContent = finalLlmRes.ok ? finalLlmRes.value.content : firstCompletion.content;

    return Result.ok({
      response: finalContent,
      role: roleDef.role,
      toolExecutions,
      pendingApprovals,
    });
  }
}
