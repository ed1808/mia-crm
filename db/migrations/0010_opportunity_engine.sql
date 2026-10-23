-- 0010_opportunity_engine.sql
-- Motor de Oportunidades, Reglas Predictivas y Grupo de Control del 15% (Decisiones D-37, D-38, D-39, D-47)

CREATE TABLE IF NOT EXISTS rule_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  params JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rule_tenant_version UNIQUE (tenant_id, rule_id, version)
);

ALTER TABLE rule_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_params FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_rule_params ON rule_params
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id VARCHAR(50) NOT NULL, -- 'R-MNT-01', 'R-MNT-02', 'R-MNT-03', 'R-WAR-01', 'R-RET-01', 'R-FLT-01', 'R-RTM-01'
  rule_version INT NOT NULL DEFAULT 1,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'detected', -- 'detected', 'in_progress', 'appointment_requested', 'converted', 'rejected', 'expired'
  score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  value_estimate NUMERIC(12,2),
  evidence JSONB NOT NULL,
  is_control_group BOOLEAN NOT NULL DEFAULT false, -- Grupo de control 15% determinista (D-39)
  expires_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  rejection_reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_opportunities ON opportunities
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_opp_tenant_status ON opportunities (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_opp_vehicle ON opportunities (tenant_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_opp_party ON opportunities (tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_opp_rule ON opportunities (tenant_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_opp_control ON opportunities (tenant_id, is_control_group);

CREATE TABLE IF NOT EXISTS contact_pressure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'whatsapp', 'call', 'email', 'sms'
  last_contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_contact_pressure UNIQUE (tenant_id, party_id, channel)
);

ALTER TABLE contact_pressure ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_pressure FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_contact_pressure ON contact_pressure
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);
