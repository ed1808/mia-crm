-- 0011_commercial_module.sql
-- MIA CRM: Commercial Module (Leads, Pipelines, Stages, Deals, Quotes, Versions, Sales)
-- Follows Clean Architecture, multi-tenancy with RLS, and Decisions D-01, D-25, D-44.

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120),
    document_type VARCHAR(20) DEFAULT 'CC',
    document_number VARCHAR(50),
    email VARCHAR(200),
    phone VARCHAR(50),
    source VARCHAR(50) NOT NULL DEFAULT 'web_form', -- web_form, api, meta_lead_ads, showroom_walk_in, referral, phone_inbound
    status VARCHAR(30) NOT NULL DEFAULT 'new', -- new, assigned, contacted, qualified, converted, discarded, duplicate
    discard_reason VARCHAR(200),
    assigned_to UUID REFERENCES app_users(id),
    party_id UUID REFERENCES parties(id),
    interested_vehicle_model VARCHAR(120),
    notes TEXT,
    sla_due_at TIMESTAMPTZ,
    first_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assigned_to);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

CREATE POLICY leads_tenant_isolation ON leads
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 2. Pipelines Table
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_tenant_code ON pipelines(tenant_id, code);
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines FORCE ROW LEVEL SECURITY;

CREATE POLICY pipelines_tenant_isolation ON pipelines
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 3. Pipeline Stages Table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    order_index INT NOT NULL,
    probability_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stages_pipeline_code ON pipeline_stages(tenant_id, pipeline_id, code);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline_order ON pipeline_stages(tenant_id, pipeline_id, order_index);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages FORCE ROW LEVEL SECURITY;

CREATE POLICY pipeline_stages_tenant_isolation ON pipeline_stages
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 4. Deals Table (Oportunidades Comerciales)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id),
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    title VARCHAR(200) NOT NULL,
    party_id UUID NOT NULL REFERENCES parties(id),
    lead_id UUID REFERENCES leads(id),
    vehicle_id UUID REFERENCES vehicles(id),
    trade_in_vehicle_id UUID REFERENCES vehicles(id),
    assigned_to UUID REFERENCES app_users(id),
    estimated_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    status VARCHAR(30) NOT NULL DEFAULT 'open', -- open, won, lost, abandoned
    loss_reason VARCHAR(200),
    expected_close_date DATE,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_pipeline_stage ON deals(tenant_id, pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_party ON deals(tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_status ON deals(tenant_id, status);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;

CREATE POLICY deals_tenant_isolation ON deals
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 5. Quotes Table
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    quote_number VARCHAR(50) NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired, reconciled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_tenant_number ON quotes(tenant_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_deal ON quotes(tenant_id, deal_id);
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

CREATE POLICY quotes_tenant_isolation ON quotes
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 6. Quote Versions Table
CREATE TABLE IF NOT EXISTS quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    base_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    taxes_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    trade_in_allowance NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_terms VARCHAR(100),
    valid_until DATE NOT NULL,
    items_json JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_versions_number ON quote_versions(tenant_id, quote_id, version_number);
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_versions_tenant_isolation ON quote_versions
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- 7. Sales Table (Conciliación con ERP, D-44)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    deal_id UUID REFERENCES deals(id),
    quote_id UUID REFERENCES quotes(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    customer_party_id UUID NOT NULL REFERENCES parties(id),
    external_order_number VARCHAR(50),
    external_invoice_number VARCHAR(50),
    sale_amount NUMERIC(15,2) NOT NULL,
    sale_date DATE NOT NULL,
    delivery_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'completed', -- pending_delivery, completed, cancelled
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_vehicle ON sales(tenant_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_customer ON sales(tenant_id, customer_party_id);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;

CREATE POLICY sales_tenant_isolation ON sales
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- Grants
GRANT ALL ON leads TO mia_app;
GRANT ALL ON pipelines TO mia_app;
GRANT ALL ON pipeline_stages TO mia_app;
GRANT ALL ON deals TO mia_app;
GRANT ALL ON quotes TO mia_app;
GRANT ALL ON quote_versions TO mia_app;
GRANT ALL ON sales TO mia_app;
