-- 0005_party_and_vehicle.sql
-- Módulos de Party (Personas / Empresas) y Vehículo como entidad de negocio de primer nivel

-- ==========================================
-- 1. MÓDULO PARTY (Terceros, Clientes, Contactos)
-- ==========================================

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_type VARCHAR(20) NOT NULL, -- 'person', 'company'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_parties ON parties
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS persons (
  party_id UUID PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150),
  birth_date DATE
);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_persons ON persons
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS companies (
  party_id UUID PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255)
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_companies ON companies
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS party_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  id_type VARCHAR(20) NOT NULL, -- 'NIT', 'CC', 'CE', 'PASAPORTE', 'TI', 'OTHER'
  id_number VARCHAR(50) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_party_identifier UNIQUE (tenant_id, id_type, id_number)
);

ALTER TABLE party_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_identifiers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_party_identifiers ON party_identifiers
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS party_contact_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'phone', 'mobile', 'email', 'address'
  value VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE party_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_contact_points FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_party_contact_points ON party_contact_points
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'whatsapp', 'email', 'sms', 'call'
  purpose VARCHAR(50) NOT NULL, -- 'service_aftersales', 'commercial', 'marketing'
  status VARCHAR(20) NOT NULL DEFAULT 'granted', -- 'granted', 'revoked'
  evidence_text TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_consents ON consents
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- Supresión definitiva de datos (Decisiones D-31 y D-32, Ley 1581)
CREATE TABLE IF NOT EXISTS suppression_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  identifier_hash VARCHAR(128) NOT NULL, -- Hash SHA-256 normalizado para bloquear re-ingesta
  reason VARCHAR(255) NOT NULL,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suppression UNIQUE (tenant_id, identifier_hash)
);

ALTER TABLE suppression_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_suppression_records ON suppression_records
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);


-- ==========================================
-- 2. MÓDULO VEHICLE (Vehículo de Primer Nivel)
-- ==========================================

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_code VARCHAR(100), -- Referencia / serie en ERP referencias_imp
  vin VARCHAR(50),
  current_plate VARCHAR(20),
  make VARCHAR(100) NOT NULL DEFAULT 'AUTODETECT',
  model VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
  model_year INT,
  color VARCHAR(50),
  engine_number VARCHAR(100),
  vehicle_type VARCHAR(50) NOT NULL DEFAULT 'passenger', -- 'passenger', 'commercial_light', 'commercial_heavy', 'bus', 'dump_truck'
  current_mileage INT,
  current_operating_hours INT,
  warranty_end_date DATE,
  rtm_due_date DATE, -- Revisión Técnico-Mecánica (D-47)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vehicle_tenant_vin UNIQUE (tenant_id, vin),
  CONSTRAINT uq_vehicle_tenant_code UNIQUE (tenant_id, external_code)
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_vehicles ON vehicles
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_vehicle_plate ON vehicles (tenant_id, current_plate);

CREATE TABLE IF NOT EXISTS plate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  plate VARCHAR(20) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ
);

ALTER TABLE plate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE plate_history FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_plate_history ON plate_history
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS usage_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL, -- 'erp_ot', 'erp_vehiculo', 'manual'
  mileage INT,
  operating_hours INT,
  reading_date TIMESTAMPTZ NOT NULL,
  is_anomaly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE usage_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_readings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_usage_readings ON usage_readings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_usage_readings_date ON usage_readings (tenant_id, vehicle_id, reading_date DESC);

-- Relación de Propiedad y Vínculos Temporales (Decisiones D-43, D-05)
-- Soporta propietario actual, propietarios históricos, conductores y copropiedad con share_percentage
CREATE TABLE IF NOT EXISTS vehicle_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'owner', -- 'owner', 'driver', 'fleet_operator', 'lienholder', 'contact'
  share_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ
);

ALTER TABLE vehicle_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_relationships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_vehicle_relationships ON vehicle_relationships
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE INDEX IF NOT EXISTS idx_vrel_active ON vehicle_relationships (tenant_id, vehicle_id, role) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_vrel_party ON vehicle_relationships (tenant_id, party_id);

-- Flotas empresariales
CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_fleets ON fleets
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

CREATE TABLE IF NOT EXISTS fleet_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

ALTER TABLE fleet_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_fleet_memberships ON fleet_memberships
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);
