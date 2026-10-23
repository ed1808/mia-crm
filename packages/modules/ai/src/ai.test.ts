// packages/modules/ai/src/ai.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SQL } from 'bun';
import { withTenant } from '@mia-crm/db';
import {
  QueryMetricUseCase,
  ExplainMetricUseCase,
  ListKpiDefinitionsUseCase,
  BunSqlMetricsRepository,
} from '@mia-crm/module-metrics';
import {
  AutonomyLevel,
  AiToolRegistry,
  ExecuteAiToolUseCase,
  ApproveExecutionUseCase,
  CopilotChatUseCase,
  BunSqlAiRepository,
  MockLlmProvider,
  QueryMetricTool,
  ExplainMetricTool,
  GetVehicle360Tool,
  GetMaintenanceStatusTool,
  ListMyLeadsTool,
  CreateTaskForMeTool,
  AddNoteTool,
  DraftMessageTool,
  RequestAppointmentTool,
  ProhibitedActionTool,
} from './index';

const ADMIN_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mia_admin:mia_admin_password@localhost:5432/mia_crm_dev';
const APP_DATABASE_URL = 'postgresql://mia_app:mia_app_password@localhost:5432/mia_crm_dev';

describe('AI Module: Autonomous Gateway, Tool Registry & D-15 Governance (M7)', () => {
  let adminSql: SQL;
  let appSql: SQL;
  let tenantId: string;
  let testUserId: string;
  let aiRepo: BunSqlAiRepository;
  let toolRegistry: AiToolRegistry;
  let executeToolUseCase: ExecuteAiToolUseCase;
  let approveExecutionUseCase: ApproveExecutionUseCase;
  let copilotChatUseCase: CopilotChatUseCase;

  beforeAll(async () => {
    adminSql = new SQL(ADMIN_DATABASE_URL);
    appSql = new SQL(APP_DATABASE_URL);

    // 1. Crear tenant de prueba
    const [t] = await adminSql<{ id: string }[]>`
      INSERT INTO tenants (name, slug) VALUES ('AI Test Dealership', 'ai-test-dealer')
      RETURNING id
    `;
    tenantId = t!.id;

    const [u] = await adminSql<{ id: string }[]>`
      INSERT INTO app_users (tenant_id, email, password_hash, full_name, role)
      VALUES (${tenantId}::uuid, 'advisor.ai@test.co', 'hash123456789', 'Asesor IA Test', 'sales_advisor')
      RETURNING id
    `;
    testUserId = u!.id;

    // 2. Inicializar repositorios y catálogo de KPIs bajo el tenant
    await withTenant(appSql, { tenantId }, async (tx) => {
      const metricsRepo = new BunSqlMetricsRepository(tx);
      const listKpis = new ListKpiDefinitionsUseCase(metricsRepo);
      await listKpis.execute();
    });

    aiRepo = new BunSqlAiRepository(appSql);
    toolRegistry = new AiToolRegistry();

    // Registrar herramientas canónicas
    toolRegistry.register(new QueryMetricTool(appSql));
    toolRegistry.register(new ExplainMetricTool(appSql));
    toolRegistry.register(new GetVehicle360Tool(appSql));
    toolRegistry.register(new GetMaintenanceStatusTool(appSql));
    toolRegistry.register(new ListMyLeadsTool(appSql));
    toolRegistry.register(new CreateTaskForMeTool(aiRepo));
    toolRegistry.register(new AddNoteTool(aiRepo));
    toolRegistry.register(new DraftMessageTool());
    toolRegistry.register(new RequestAppointmentTool());
    toolRegistry.register(new ProhibitedActionTool());

    executeToolUseCase = new ExecuteAiToolUseCase(toolRegistry, aiRepo);
    approveExecutionUseCase = new ApproveExecutionUseCase(aiRepo);
    copilotChatUseCase = new CopilotChatUseCase(
      toolRegistry,
      executeToolUseCase,
      new MockLlmProvider(),
    );

    // 3. Crear fixtures de vehículos y leads para pruebas contextuales
    await withTenant(appSql, { tenantId }, async (tx) => {
      const [v] = await tx<{ id: string }[]>`
        INSERT INTO vehicles (tenant_id, vin, current_plate, make, model, model_year, current_mileage)
        VALUES (${tenantId}::uuid, 'VINAI123456789012', 'MIA001', 'Toyota', 'Corolla Cross', 2023, 19500)
        RETURNING id
      `;

      await tx`
        INSERT INTO next_visit_projections (
          tenant_id, vehicle_id, projected_date, projected_mileage,
          projection_method, confidence_level, calculation_basis
        ) VALUES (
          ${tenantId}::uuid, ${v!.id}::uuid, CURRENT_DATE + INTERVAL '10 days', 20000,
          'own_history', 'high', '{"interval_days": 180}'::jsonb
        )
      `;

      await tx`
        INSERT INTO leads (
          tenant_id, first_name, last_name, phone, email, source,
          status, sla_due_at, interested_vehicle_model
        ) VALUES (
          ${tenantId}::uuid, 'Mauricio', 'Cárdenas', '3109876543', 'mauricio@example.co', 'web_form',
          'new', NOW() + INTERVAL '12 minutes', 'Toyota Hilux'
        )
      `;
    });
  });

  afterAll(async () => {
    if (adminSql && tenantId) {
      await adminSql`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
      await adminSql.close();
    }
    if (appSql) {
      await appSql.close();
    }
  });

  describe('1. Autonomy Level Policies & D-15 Enforcement', () => {
    it('Level 0 (Read-only): Executes immediately and records execution in audit repository', async () => {
      const res = await executeToolUseCase.execute({
        context: { tenantId, role: 'executive_manager', taskType: 'T7' },
        toolName: 'query_metric',
        arguments: { kpiCode: 'vehicle_retention_rate' },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('executed');
        expect(res.value.autonomyLevel).toBe(AutonomyLevel.LEVEL_0_READ_ONLY);
        expect(res.value.data.kpiCode).toBe('vehicle_retention_rate');
      }
    });

    it('Level 1 (Reversible user write): Automatically creates and persists an advisor task', async () => {
      const res = await executeToolUseCase.execute({
        context: { tenantId, role: 'sales_advisor', taskType: 'T6' },
        toolName: 'create_task_for_me',
        arguments: {
          title: 'Llamar a Mauricio Cárdenas por cotización de Hilux',
          description: 'Lead con SLA crítico',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('executed');
        expect(res.value.autonomyLevel).toBe(AutonomyLevel.LEVEL_1_REVERSIBLE_WRITE);

        // Verificar que la tarea está persistida en advisor_tasks
        const tasks = await aiRepo.listByUser(tenantId, null);
        expect(tasks.length).toBeGreaterThan(0);
        expect(tasks[0]?.toJSON().title).toContain('Mauricio Cárdenas');
      }
    });

    it('Level 2 (Requires approval): Prepares proposal and enters pending_approval status', async () => {
      const res = await executeToolUseCase.execute({
        context: { tenantId, role: 'service_advisor', taskType: 'T4' },
        toolName: 'draft_message',
        arguments: {
          phone: '3109876543',
          recipientName: 'Mauricio',
          messageBody: 'Hola Mauricio, confirmamos tu cita de taller para mañana a las 8:00 AM.',
          channel: 'whatsapp',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('pending_approval');
        expect(res.value.autonomyLevel).toBe(AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL);
        expect(res.value.proposal.waMeUrl).toContain('https://wa.me/573109876543');

        // Simular que el asesor humano aprueba la acción
        const approveRes = await approveExecutionUseCase.execute({
          tenantId,
          executionId: res.value.executionId,
          userId: testUserId,
          action: 'approve',
        });

        expect(approveRes.ok).toBe(true);
        if (approveRes.ok) {
          expect(approveRes.value.status).toBe('approved');
        }
      }
    });

    it('Level 3 (Prohibited): Blocks execution with domain error and marks status as prohibited', async () => {
      const res = await executeToolUseCase.execute({
        context: { tenantId, role: 'service_advisor', taskType: 'T10' },
        toolName: 'prohibited_security_action',
        arguments: { actionType: 'delete_data' },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain('Nivel 3');
      }

      // Verificar que quedó registrado como prohibited en la base de datos
      const executions = await aiRepo.listRecent(tenantId, 5);
      const prohibited = executions.find((e) => e.status === 'prohibited');
      expect(prohibited).toBeDefined();
    });
  });

  describe('2. Governed KPI Grounding (D-16: Cero Alucinaciones)', () => {
    it('explains metric formula in plain Colombian Spanish using explain_metric', async () => {
      const res = await executeToolUseCase.execute({
        context: { tenantId, role: 'executive_manager', taskType: 'T3' },
        toolName: 'explain_metric',
        arguments: { kpiCode: 'vehicle_retention_rate' },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.data.formula).toBe(
          '(vehiculos_con_servicio_ultimos_12m / parque_atribuible_activo) * 100',
        );
        expect(res.value.data.businessInterpretation).toContain('Colombia');
      }
    });
  });

  describe('3. Multi-role Copilot Orchestration (M7b)', () => {
    it('Sales Advisor Copilot: prioritizes leads with critical SLA (< 15 mins)', async () => {
      const chatRes = await copilotChatUseCase.execute({
        tenantId,
        role: 'sales_advisor',
        message: '¿Qué hago hoy con mis leads?',
      });

      expect(chatRes.ok).toBe(true);
      if (chatRes.ok) {
        expect(chatRes.value.toolExecutions.length).toBeGreaterThan(0);
        const leadTool = chatRes.value.toolExecutions.find((t) => t.toolName === 'list_my_leads');
        expect(leadTool).toBeDefined();
        const leads = leadTool?.data as any[];
        expect(leads.length).toBeGreaterThan(0);
        const criticalLead = leads.find((l) => l.fullName.includes('Mauricio'));
        expect(criticalLead).toBeDefined();
        expect(criticalLead.slaCritical).toBe(true);
      }
    });

    it('Service Advisor Copilot: inspects vehicle maintenance projection and odometers', async () => {
      const chatRes = await copilotChatUseCase.execute({
        tenantId,
        role: 'service_advisor',
        message: 'Consulta el mantenimiento del vehiculo con placa MIA001',
      });

      expect(chatRes.ok).toBe(true);
      if (chatRes.ok) {
        const mtoTool = chatRes.value.toolExecutions.find(
          (t) => t.toolName === 'get_maintenance_status',
        );
        expect(mtoTool).toBeDefined();
        expect(mtoTool?.data.plate).toBe('MIA001');
        expect(mtoTool?.data.current_mileage).toBe(19500);
        expect(mtoTool?.data.daysRemaining).toBeLessThanOrEqual(10);
      }
    });

    it('Executive Copilot: queries semantic retention rate and provides governed answers', async () => {
      const chatRes = await copilotChatUseCase.execute({
        tenantId,
        role: 'executive_manager',
        message: '¿Cómo está la retención de vehículos del concesionario?',
      });

      expect(chatRes.ok).toBe(true);
      if (chatRes.ok) {
        const queryTool = chatRes.value.toolExecutions.find((t) => t.toolName === 'query_metric');
        expect(queryTool).toBeDefined();
        expect(queryTool?.data.kpiCode).toBe('vehicle_retention_rate');
      }
    });
  });
});
