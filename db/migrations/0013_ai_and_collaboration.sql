-- 0013_ai_and_collaboration.sql
-- MIA CRM: AI Tool Execution Governance, Collaboration Tasks & Notes (Decisions D-14, D-15, D-16, D-24, D-26, D-30, D-36)

-- 1. Registro de Ejecución de AI Tools con Niveles de Autonomía (D-15)
CREATE TABLE IF NOT EXISTS ai_tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL, -- 'sales_advisor', 'service_advisor', 'sales_manager', 'executive_manager', 'system'
    task_type VARCHAR(50) NOT NULL, -- 'T1'..'T11' según Matriz D-36
    tool_name VARCHAR(100) NOT NULL,
    autonomy_level INT NOT NULL CHECK (autonomy_level BETWEEN 0 AND 3),
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'executed', -- 'executed', 'pending_approval', 'approved', 'rejected', 'failed', 'prohibited'
    rejection_reason TEXT,
    approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_tenant_user ON ai_tool_executions(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_status ON ai_tool_executions(tenant_id, status);

ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_tool_executions_tenant_isolation ON ai_tool_executions
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

GRANT ALL ON ai_tool_executions TO mia_app;

-- 2. Tareas de Asesor / Seguimiento (Nivel 1 de Autonomía)
CREATE TABLE IF NOT EXISTS advisor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50), -- 'vehicle', 'party', 'deal', 'opportunity', 'lead'
    entity_id VARCHAR(100),
    due_date TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_tasks_tenant_user ON advisor_tasks(tenant_id, user_id, status);

ALTER TABLE advisor_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY advisor_tasks_tenant_isolation ON advisor_tasks
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

GRANT ALL ON advisor_tasks TO mia_app;

-- 3. Notas Contextuales de Negocio (Nivel 1 de Autonomía)
CREATE TABLE IF NOT EXISTS internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    author_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'vehicle', 'party', 'deal', 'opportunity', 'lead'
    entity_id VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_notes_entity ON internal_notes(tenant_id, entity_type, entity_id);

ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY internal_notes_tenant_isolation ON internal_notes
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

GRANT ALL ON internal_notes TO mia_app;
