// apps/api/src/routes/ai.ts
import { Hono } from 'hono';
import {
  AiToolRegistry,
  ExecuteAiToolUseCase,
  ApproveExecutionUseCase,
  CopilotChatUseCase,
  BunSqlAiRepository,
  MockLlmProvider,
  GeminiLlmProvider,
  QueryMetricTool,
  ExplainMetricTool,
  GetVehicle360Tool,
  GetMaintenanceStatusTool,
  ListMyLeadsTool,
  ListMyOpportunitiesTool,
  GetCustomer360Tool,
  CreateTaskForMeTool,
  AddNoteTool,
  DraftMessageTool,
  RequestAppointmentTool,
  CreateOpportunityTool,
  ProhibitedActionTool,
} from '@mia-crm/module-ai';
import { tenantMiddleware } from '../middleware/tenant';

export function createAiRouter() {
  const router = new Hono();

  router.use('*', tenantMiddleware);

  // Inicializador perezoso del registro y orquestador
  let initializedRegistry: AiToolRegistry | null = null;
  let initializedRepo: BunSqlAiRepository | null = null;

  function getServices(db: any) {
    if (!initializedRegistry || !initializedRepo) {
      initializedRepo = new BunSqlAiRepository(db);
      initializedRegistry = new AiToolRegistry();

      initializedRegistry.register(new QueryMetricTool(db));
      initializedRegistry.register(new ExplainMetricTool(db));
      initializedRegistry.register(new GetVehicle360Tool(db));
      initializedRegistry.register(new GetMaintenanceStatusTool(db));
      initializedRegistry.register(new ListMyLeadsTool(db));
      initializedRegistry.register(new ListMyOpportunitiesTool(db));
      initializedRegistry.register(new GetCustomer360Tool(db));
      initializedRegistry.register(new CreateTaskForMeTool(initializedRepo));
      initializedRegistry.register(new AddNoteTool(initializedRepo));
      initializedRegistry.register(new DraftMessageTool());
      initializedRegistry.register(new RequestAppointmentTool());
      initializedRegistry.register(new CreateOpportunityTool());
      initializedRegistry.register(new ProhibitedActionTool());
    }

    const executeToolUseCase = new ExecuteAiToolUseCase(initializedRegistry, initializedRepo);
    const approveExecutionUseCase = new ApproveExecutionUseCase(initializedRepo);
    const llmProvider = process.env.GEMINI_API_KEY
      ? new GeminiLlmProvider()
      : new MockLlmProvider();

    const copilotChatUseCase = new CopilotChatUseCase(
      initializedRegistry,
      executeToolUseCase,
      llmProvider,
    );

    return {
      registry: initializedRegistry,
      repo: initializedRepo,
      executeToolUseCase,
      approveExecutionUseCase,
      copilotChatUseCase,
    };
  }

  // POST /api/v1/ai/chat — Chat contextual con Copiloto MIA
  router.post('/chat', async (c) => {
    const { tenantId, user } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const { copilotChatUseCase } = getServices(db);

    const result = await copilotChatUseCase.execute({
      tenantId,
      userId: user?.id || null,
      role: body.role || 'sales_advisor',
      message: body.message || '',
      conversationHistory: body.conversationHistory || [],
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: result.value });
  });

  // GET /api/v1/ai/tools — Catálogo de tools por rol con niveles de autonomía D-15
  router.get('/tools', (c) => {
    const db = c.get('db');
    const role = c.req.query('role') || 'sales_advisor';
    const { registry } = getServices(db);

    const tools = registry.listForRole(role);
    return c.json({ data: tools });
  });

  // POST /api/v1/ai/execute — Ejecución directa de una tool gobernada
  router.post('/execute', async (c) => {
    const { tenantId, user } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const { executeToolUseCase } = getServices(db);

    const result = await executeToolUseCase.execute({
      context: {
        tenantId,
        userId: user?.id || null,
        role: body.role || 'sales_advisor',
        taskType: body.taskType || 'T6',
      },
      toolName: body.toolName,
      arguments: body.arguments || {},
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: result.value });
  });

  // POST /api/v1/ai/approve — Aprobación humana de una acción Nivel 2
  router.post('/approve', async (c) => {
    const { tenantId, user } = c.get('tenant');
    const db = c.get('db');
    const body = await c.req.json();

    const { approveExecutionUseCase } = getServices(db);

    const result = await approveExecutionUseCase.execute({
      tenantId,
      executionId: body.executionId,
      userId: user?.id || body.userId || null,
      action: body.action || 'approve',
      rejectionReason: body.rejectionReason,
    });

    if (!result.ok) {
      return c.json({ error: result.error.message, code: result.error.code }, 400);
    }

    return c.json({ data: result.value });
  });

  // GET /api/v1/ai/pending — Listado de propuestas Nivel 2 pendientes de aprobación
  router.get('/pending', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const { repo } = getServices(db);

    const pending = await repo.listPendingApprovals(tenantId);
    return c.json({ data: pending.map((p) => p.toJSON()) });
  });

  // GET /api/v1/ai/history — Trazabilidad y auditoría de ejecuciones de AI Tools
  router.get('/history', async (c) => {
    const { tenantId } = c.get('tenant');
    const db = c.get('db');
    const { repo } = getServices(db);

    const limit = Number(c.req.query('limit')) || 20;
    const history = await repo.listRecent(tenantId, limit);
    return c.json({ data: history.map((h) => h.toJSON()) });
  });

  return router;
}
