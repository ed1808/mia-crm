-- 0009_aftersales_and_maintenance.sql
-- Módulo de Posventa (Órdenes de Trabajo, Líneas, Citas) y Motor de Proyección (D-35, D-46)

-- =======================================================
-- 1. POSVENTA (Work Orders, Order Lines, Appointments)
-- =======================================================

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NOT NULL, -- ej. "bodega_numero" del ERP
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  order_number INT NOT NULL,
  branch_code INT NOT NULL,
  order_type VARCHAR(50) NOT NULL, -- 'maintenance', 'repair', 'warranty', 'collision', 'recall_campaign', 'internal', 'quick_service' (D-46)
  status VARCHAR(50) NOT NULL DEFAULT 'opened', -- 'opened', 'in_progress', 'completed', 'voided', 'billed'
  mileage INT,
  operating_hours INT,
  entered_at TIMESTAMPTZ NOT NULL,
  promised_delivery_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  insurance_company_nit VARCHAR(50),
  is_billed BOOLEAN NOT NULL DEFAULT false,
  is_voided BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_work_order_external UNIQUE (tenant_id, external_id)
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_work_orders ON work_orders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_wo_vehicle ON work_orders (tenant_id, vehicle_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_wo_party ON work_orders (tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_wo_type ON work_orders (tenant_id, order_type);

CREATE TABLE IF NOT EXISTS work_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  line_type VARCHAR(20) NOT NULL, -- 'labor', 'part', 'service'
  item_code VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  charge_to VARCHAR(30) NOT NULL DEFAULT 'customer', -- 'customer', 'warranty', 'internal', 'insurance'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_work_order_lines ON work_order_lines
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'attended', 'cancelled', 'no_show'
  origin VARCHAR(30) NOT NULL DEFAULT 'CRM', -- 'CRM', 'ERP', 'WEB' (D-19)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_appointments ON appointments
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);


-- =======================================================
-- 2. MANTENIMIENTO PREVENTIVO Y PROYECCIÓN (D-35)
-- =======================================================

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL DEFAULT 'passenger',
  make VARCHAR(100),
  model VARCHAR(100),
  default_km_interval INT NOT NULL DEFAULT 10000,
  default_days_interval INT NOT NULL DEFAULT 180,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_maintenance_plans ON maintenance_plans
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS next_visit_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  projected_date DATE NOT NULL,
  projected_mileage INT,
  projection_method VARCHAR(50) NOT NULL, -- 'own_history', 'cohort', 'plan'
  confidence_level VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
  calculation_basis JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_projection_vehicle UNIQUE (tenant_id, vehicle_id)
);

ALTER TABLE next_visit_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_visit_projections FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_next_visit_projections ON next_visit_projections
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_projection_date ON next_visit_projections (tenant_id, projected_date);
