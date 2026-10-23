-- 0012_semantic_metrics.sql
-- MIA CRM: Semantic Metrics Layer & Governed KPI Definitions (Decisions D-13, D-16, D-27, D-39, D-50)

CREATE TABLE IF NOT EXISTS kpi_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    formula TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'retention', 'aftersales', 'commercial', 'experimentation'
    unit VARCHAR(20) NOT NULL, -- 'percentage', 'currency_cop', 'count', 'days', 'hours'
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_definitions_tenant_code_version 
    ON kpi_definitions(tenant_id, code, version);

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category 
    ON kpi_definitions(tenant_id, category);

ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY kpi_definitions_tenant_isolation ON kpi_definitions
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

GRANT ALL ON kpi_definitions TO mia_app;
